import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { canStartTrip } from '@/lib/trip-tracking';
import { notifyUser } from '@/lib/notifications';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/rides/{id}/start
 *
 * Provider-only: starts the trip for a ride the caller owns, moving the ride
 * into the In Progress state (REQ-1 / REQ-2). Starting is only allowed from a
 * bookable state (Active or Full) — an already-In-Progress, Completed, or
 * Cancelled ride is rejected (Section 11 — Validation Rules).
 *
 * On success every Seeker with an Accepted request on the ride is notified that
 * the trip has started (Section 10.1) and gains access to the live location
 * view (REQ-4 / REQ-5).
 *
 * Responses:
 *   - 200 { ok: true, ride }        on success (ride.status === IN_PROGRESS)
 *   - 400 { ok: false, error }      malformed ride id
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found / not owned by the caller
 *   - 409 { ok: false, error }      the ride cannot be started from its state
 *   - 500 { ok: false, error }      unexpected failure
 */
export async function POST(_request: Request, { params }: RouteContext) {
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
    if (!ride || ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    if (!canStartTrip(ride.status)) {
      return Response.json(
        {
          ok: false,
          error:
            ride.status === 'IN_PROGRESS'
              ? 'This trip has already started.'
              : 'This ride cannot be started from its current state.'
        },
        { status: 409 }
      );
    }

    const started = await prisma.ride.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() }
    });

    // Section 10.1: every Accepted Seeker is notified the trip has started and
    // gains access to the live location view.
    const acceptedRequests = await prisma.rideRequest.findMany({
      where: { rideId: id, status: 'ACCEPTED' },
      select: { seekerId: true }
    });

    await Promise.all(
      acceptedRequests.map((request) =>
        notifyUser(request.seekerId, 'TripStarted', {
          rideId: id,
          destinationAddress: ride.destinationAddress
        })
      )
    );

    return NextResponse.json({ ok: true, ride: started });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Trip start failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
