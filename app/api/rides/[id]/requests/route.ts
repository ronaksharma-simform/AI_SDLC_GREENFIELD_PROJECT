import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rideRequestCreateSchema } from '@/lib/validation';
import { isValidUuid } from '@/lib/rides';
import { notifyUser } from '@/lib/notifications';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/rides/{id}/requests
 *
 * Provider-only: lists the requests received for one of the caller's rides.
 * A ride that does not exist and a ride that belongs to someone else both
 * resolve to the same 404 (Section 10 — Access Control).
 *
 * Responses:
 *   - 200 { ok: true, requests }   on success
 *   - 400 { ok: false, error }     malformed ride id
 *   - 401 { ok: false, error }     no valid session
 *   - 404 { ok: false, error }     ride not found / not owned by the caller
 *   - 500 { ok: false, error }     unexpected failure
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
    const ride = await prisma.ride.findUnique({
      where: { id },
      select: { id: true, providerId: true }
    });

    if (!ride || ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    const requests = await prisma.rideRequest.findMany({
      where: { rideId: id },
      include: { seeker: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride request listing failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/rides/{id}/requests
 *
 * Seeker-facing: sends a request to join a specific ride (REQ-15).
 *
 * Validation (Section 8 / Section 9):
 *   - the ride must exist and be ACTIVE;
 *   - `seatsRequested` must not exceed the ride's current `seatsAvailable`
 *     (REQ-19a) — availability is the single source of truth, read live;
 *   - the Seeker may not have another PENDING or ACCEPTED request on the same
 *     ride (REQ-19b / active-request uniqueness).
 *
 * A Pending request reserves NO seats; availability is only decremented when
 * the Provider accepts (Section 9). The Provider is notified (REQ-16).
 *
 * Accepts a JSON body: { "seatsRequested": number, "message"?: string }
 *
 * Responses:
 *   - 201 { ok: true, request }    on success
 *   - 400 { ok: false, error, details? }  malformed JSON, failed validation, the
 *                                      ride is not accepting requests, not enough
 *                                      seats, or a duplicate active request
 *   - 401 { ok: false, error }     no valid session
 *   - 404 { ok: false, error }     ride not found
 *   - 500 { ok: false, error }     unexpected failure
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

  const parsed = rideRequestCreateSchema.safeParse(body);
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

  const { seatsRequested, message } = parsed.data;

  try {
    const ride = await prisma.ride.findUnique({ where: { id } });

    if (!ride) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    // Section 8 — Validation Rules: a request targets an Active ride only.
    // FULL / CANCELLED / COMPLETED rides are not open for requests.
    if (ride.status !== 'ACTIVE') {
      return Response.json(
        { ok: false, error: 'This ride is no longer accepting requests.' },
        { status: 400 }
      );
    }

    // REQ-19a: never over-subscribe. Availability is the single source of truth.
    if (seatsRequested > ride.seatsAvailable) {
      return Response.json(
        {
          ok: false,
          error: `Only ${ride.seatsAvailable} seat(s) available on this ride.`
        },
        { status: 400 }
      );
    }

    // REQ-19b: one active (Pending or Accepted) request per Seeker per ride.
    const existing = await prisma.rideRequest.findFirst({
      where: {
        rideId: id,
        seekerId: session.user.id,
        status: { in: ['PENDING', 'ACCEPTED'] }
      }
    });

    if (existing) {
      return Response.json(
        { ok: false, error: 'You already have an active request for this ride.' },
        { status: 400 }
      );
    }

    const created = await prisma.rideRequest.create({
      data: {
        rideId: id,
        seekerId: session.user.id,
        seatsRequested,
        status: 'PENDING',
        message: message ?? null
      }
    });

    // REQ-16 / NOTIF-1: the Provider is notified of the new request. Delivery
    // is the Notifications module's concern; `seekerName` lets it build the
    // "New ride request from …" copy.
    await notifyUser(ride.providerId, 'RideRequestReceived', {
      rideId: id,
      requestId: created.id,
      seekerName: session.user.name ?? session.user.email ?? undefined
    });

    return NextResponse.json({ ok: true, request: created }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride request creation failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
