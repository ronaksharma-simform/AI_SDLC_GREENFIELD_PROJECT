import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import {
  rideFeedQuerySchema,
  DEFAULT_FEED_TOLERANCE_MINUTES,
  DEFAULT_PROXIMITY_RADIUS_METERS
} from '@/lib/validation';

/**
 * GET /api/rides/feed
 *
 * Ride Discovery Feed (REQ-9 / REQ-10 / REQ-11). Returns currently open rides
 * that a Seeker could request, optionally filtered by:
 *
 *   - `source`      — free-text match against the ride's source address
 *   - `destination` — free-text match against the ride's destination address
 *   - `time`        — rides departing within `±window`/`±toleranceMinutes`
 *                     (default 30) of this date/time (REQ-13a)
 *   - `window` / `toleranceMinutes` — configures the departure-time window
 *   - `seats`       — rides with at least this many available seats (REQ-13b)
 *   - `lat` / `lng` — the Seeker's pickup point; when both are present the feed
 *                     is narrowed to rides whose pickup point is within `radius`
 *                     meters (Part B proximity filter, REQ-1/REQ-2)
 *   - `radius`      — proximity radius in meters (default 500, REQ-2)
 *
 * The feed always excludes Cancelled / Completed / Full rides (REQ-13c) and the
 * caller's own created rides (REQ-13d). Results are sorted by closest departure
 * time match to the requested `time` first (most relevant first), falling back
 * to soonest departure.
 *
 * The proximity filter is computed server-side inside the database query
 * (Haversine in PostgreSQL SQL, REQ-6); the app never fetches the full ride
 * table to filter it in application code.
 *
 * Responses:
 *   - 200 { ok: true, rides }    on success
 *   - 400 { ok: false, error, details? }  invalid query parameters
 *   - 401 { ok: false, error }   no valid session
 *   - 500 { ok: false, error }   unexpected failure
 */
export async function GET(request: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Only pass through query keys that were actually provided so an empty value
  // does not silently coerce to 0 / Invalid Date.
  const raw: Record<string, string> = {};
  for (const key of [
    'source',
    'destination',
    'time',
    'seats',
    'toleranceMinutes',
    'window',
    'lat',
    'lng',
    'radius'
  ] as const) {
    const value = searchParams.get(key);
    if (value !== null && value !== '') raw[key] = value;
  }

  const parsed = rideFeedQuerySchema.safeParse(raw);
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

  const {
    source,
    destination,
    time,
    seats,
    toleranceMinutes,
    window: windowMinutes,
    lat,
    lng,
    radius
  } = parsed.data;
  // Part B — `window` is the preferred name for the time-window filter;
  // `toleranceMinutes` is kept for backwards compatibility with the base spec.
  const toleranceMs = (windowMinutes ?? toleranceMinutes ?? DEFAULT_FEED_TOLERANCE_MINUTES) * 60_000;
  const radiusMeters = radius ?? DEFAULT_PROXIMITY_RADIUS_METERS;

  try {
    const where: Prisma.RideWhereInput = {
      // REQ-13c: the feed only surfaces open, bookable rides.
      status: 'ACTIVE',
      // REQ-13d: never show the Seeker their own offered rides.
      providerId: { not: session.user.id }
    };

    if (source) {
      where.sourceAddress = { contains: source, mode: 'insensitive' };
    }
    if (destination) {
      where.destinationAddress = { contains: destination, mode: 'insensitive' };
    }
    if (time) {
      where.departureTime = {
        gte: new Date(time.getTime() - toleranceMs),
        lte: new Date(time.getTime() + toleranceMs)
      };
    }
    if (seats) {
      // REQ-13b: at least as many available seats as the Seeker needs.
      where.seatsAvailable = { gte: seats };
    }

    // Part B — Proximity filter (REQ-1 / REQ-2 / REQ-6). Applied only when the
    // Seeker supplies a pickup point (both coordinates are required; a missing
    // pair is skipped rather than defaulting to an arbitrary location). The
    // great-circle distance is computed inside the database query via the
    // Haversine formula in PostgreSQL SQL, and the matching ride ids become a
    // precise pre-filter — we never pull the full ride table into application
    // code to filter it here.
    if (lat !== undefined && lng !== undefined) {
      const candidates = await prisma.$queryRaw<{ id: string }[]>`
        SELECT r.id
        FROM rides r
        WHERE r.status = 'ACTIVE'
          AND r.provider_id <> ${session.user.id}
          AND (
            6371000 * 2 * asin(
              sqrt(
                power(sin(radians(r.source_latitude - ${lat}) / 2), 2)
                + cos(radians(r.source_latitude)) * cos(radians(${lat}))
                * power(sin(radians(r.source_longitude - ${lng}) / 2), 2)
              )
            )
          ) <= ${radiusMeters}
      `;

      const ids = candidates.map((row) => row.id);
      if (ids.length === 0) {
        return NextResponse.json({ ok: true, rides: [] });
      }
      where.id = { in: ids };
    }

    const rides = await prisma.ride.findMany({
      where,
      include: {
        vehicle: true,
        provider: { select: { id: true, name: true, email: true } }
      }
    });

    // Sort by closest departure time to the requested `time` (most relevant
    // first); without a `time` filter, soonest departure wins.
    const sorted = [...rides].sort((a, b) => {
      const aDeparture = new Date(a.departureTime).getTime();
      const bDeparture = new Date(b.departureTime).getTime();
      if (time) {
        const pivot = time.getTime();
        return Math.abs(aDeparture - pivot) - Math.abs(bDeparture - pivot);
      }
      return aDeparture - bDeparture;
    });

    return NextResponse.json({ ok: true, rides: sorted });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride feed failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
