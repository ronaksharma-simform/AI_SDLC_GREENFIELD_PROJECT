import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { locationUpdateSchema } from '@/lib/validation';
import {
  canAcceptLocationUpdates,
  MIN_LOCATION_UPDATE_INTERVAL_MS,
  LOCATION_SNAPSHOT_INTERVAL_MS
} from '@/lib/trip-tracking';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Serializes a Prisma ride into the slim location payload the live map consumes.
 * Coordinates are Decimal in the DB and are surfaced as numbers (or null when
 * the Provider has not reported a position yet).
 */
function locationPayload(ride: {
  id: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  currentLatitude: unknown;
  currentLongitude: unknown;
  locationUpdatedAt: Date | null;
  sourceLatitude: unknown;
  sourceLongitude: unknown;
  destinationLatitude: unknown;
  destinationLongitude: unknown;
}) {
  const toNumber = (value: unknown): number | null => (value == null ? null : Number(value));
  return {
    id: ride.id,
    status: ride.status,
    startedAt: ride.startedAt,
    completedAt: ride.completedAt,
    currentLatitude: toNumber(ride.currentLatitude),
    currentLongitude: toNumber(ride.currentLongitude),
    locationUpdatedAt: ride.locationUpdatedAt,
    sourceLatitude: toNumber(ride.sourceLatitude),
    sourceLongitude: toNumber(ride.sourceLongitude),
    destinationLatitude: toNumber(ride.destinationLatitude),
    destinationLongitude: toNumber(ride.destinationLongitude)
  };
}

/**
 * POST /api/rides/{id}/location
 *
 * Provider-only: reports the Provider's current position while the trip is In
 * Progress (REQ-3). Validates the coordinates, rate-limits submissions that
 * arrive faster than the server-side minimum interval (Section 12), overwrites
 * the ride's single current-position fields (Section 10.2), and — at a lower
 * frequency — writes a snapshot to the Trip Location History table.
 *
 * Updates submitted when the ride is not In Progress are rejected (Section 11);
 * broadcasting therefore stops automatically once the trip is Completed or
 * Cancelled (REQ-7).
 *
 * Responses:
 *   - 200 { ok: true, ride }        on success (ride carries the new position)
 *   - 400 { ok: false, error, details? }  malformed id/JSON, failed validation
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found / not owned by the caller
 *   - 409 { ok: false, error }      the ride is not In Progress
 *   - 429 { ok: false, error }      submitted faster than the rate limit
 *   - 500 { ok: false, error }      unexpected failure
 */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid ride ID.' }, { status: 400 });
  }

  const raw = await request.text();
  if (!raw.trim()) {
    return Response.json(
      { ok: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { ok: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const parsed = locationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const { latitude, longitude } = parsed.data;

  try {
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride || ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    if (!canAcceptLocationUpdates(ride.status)) {
      return Response.json(
        { ok: false, error: 'Location updates are only accepted while the trip is in progress.' },
        { status: 409 }
      );
    }

    // Section 12 — rate limit: reject updates submitted faster than the
    // server-side minimum interval, independent of the frontend's own interval.
    if (ride.locationUpdatedAt != null) {
      const elapsed = Date.now() - new Date(ride.locationUpdatedAt).getTime();
      if (elapsed < MIN_LOCATION_UPDATE_INTERVAL_MS) {
        return Response.json(
          { ok: false, error: 'Location updates are being sent too frequently.' },
          { status: 429 }
        );
      }
    }

    const now = new Date();
    const updated = await prisma.ride.update({
      where: { id },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
        locationUpdatedAt: now
      }
    });

    // Section 10.2 — at a lower frequency (not every update), persist a snapshot
    // to the history table for later dispute resolution / safety review. The
    // live map never reads this table.
    const latestSnapshot = await prisma.rideLocationSnapshot.findFirst({
      where: { rideId: id },
      orderBy: { recordedAt: 'desc' },
      select: { recordedAt: true }
    });
    const snapshotDue =
      latestSnapshot == null ||
      now.getTime() - new Date(latestSnapshot.recordedAt).getTime() >= LOCATION_SNAPSHOT_INTERVAL_MS;

    if (snapshotDue) {
      await prisma.rideLocationSnapshot.create({
        data: {
          rideId: id,
          latitude,
          longitude,
          recordedAt: now
        }
      });
    }

    return NextResponse.json({ ok: true, ride: locationPayload(updated) });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Location update failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * GET /api/rides/{id}/location
 *
 * Seeker or Provider: reads the ride's current live position (REQ-4 / REQ-5).
 * Access is restricted to the ride's Provider and Seekers with an Accepted
 * request on that specific ride (REQ-8, Section 13). The client polls this
 * endpoint at an interval consistent with how often the Provider's device
 * produces updates (Section 10.3).
 *
 * Responses:
 *   - 200 { ok: true, ride }        on success (slim location payload)
 *   - 400 { ok: false, error }      malformed ride id
 *   - 401 { ok: false, error }      no valid session
 *   - 403 { ok: false, error }      not the Provider nor an Accepted Seeker
 *   - 404 { ok: false, error }      ride not found
 *   - 500 { ok: false, error }      unexpected failure
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid ride ID.' }, { status: 400 });
  }

  try {
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    const isProvider = ride.providerId === session.user.id;
    const acceptedSeeker = isProvider
      ? null
      : await prisma.rideRequest.findFirst({
          where: { rideId: id, seekerId: session.user.id, status: 'ACCEPTED' },
          select: { id: true }
        });

    if (!isProvider && !acceptedSeeker) {
      return Response.json(
        { ok: false, error: 'You do not have access to this ride\'s live location.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ ok: true, ride: locationPayload(ride) });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Location fetch failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
