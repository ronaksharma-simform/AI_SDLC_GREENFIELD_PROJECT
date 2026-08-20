import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { notifyUser } from '@/lib/notifications';

type RouteContext = { params: Promise<{ id: string }> };

/** Thrown when the ride no longer has enough seats to accept this request. */
class InsufficientSeatsError extends Error {}

/**
 * PATCH /api/requests/{id}/accept
 *
 * Provider-only: accepts a Pending request (REQ-17 / REQ-18).
 *
 * On accept (REQ-19c):
 *   - the request becomes ACCEPTED and is stamped with `respondedAt`;
 *   - the ride's `seatsAvailable` is decremented by `seatsRequested` — seat
 *     availability is the single source of truth, updated atomically;
 *   - if the ride's available seats reach zero it is marked FULL (and drops out
 *     of the discovery feed automatically, REQ-13c);
 *   - the Seeker is notified of the outcome (REQ-19d).
 *
 * A request that does not exist, or whose ride belongs to another user, both
 * resolve to 404 (Section 10 — Access Control).
 *
 * Responses:
 *   - 200 { ok: true, request, ride }   on success
 *   - 400 { ok: false, error }          malformed request id
 *   - 401 { ok: false, error }          no valid session
 *   - 404 { ok: false, error }          request not found / not for a ride owned by the caller
 *   - 409 { ok: false, error }          request is no longer pending, or the ride no longer
 *                                       has enough available seats
 *   - 500 { ok: false, error }          unexpected failure
 */
export async function PATCH(_request: Request, { params }: RouteContext) {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid request ID.' }, { status: 400 });
  }

  try {
    const rideRequest = await prisma.rideRequest.findUnique({
      where: { id },
      include: { ride: true }
    });

    if (!rideRequest || rideRequest.ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Request not found.' }, { status: 404 });
    }

    if (rideRequest.status !== 'PENDING') {
      return Response.json(
        { ok: false, error: 'Only a pending request can be accepted.' },
        { status: 409 }
      );
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const freshRide = await tx.ride.findUnique({ where: { id: rideRequest.rideId } });
        if (!freshRide || freshRide.seatsAvailable < rideRequest.seatsRequested) {
          throw new InsufficientSeatsError();
        }

        const nextAvailable = freshRide.seatsAvailable - rideRequest.seatsRequested;

        const ride = await tx.ride.update({
          where: { id: rideRequest.rideId },
          data: {
            seatsAvailable: nextAvailable,
            // REQ-19c: mark the ride Full when the last seat is taken.
            status: nextAvailable === 0 ? 'FULL' : freshRide.status
          }
        });

        const updatedRequest = await tx.rideRequest.update({
          where: { id },
          data: { status: 'ACCEPTED', respondedAt: new Date() }
        });

        return { request: updatedRequest, ride };
      });

      // REQ-19d: the Seeker is notified of the acceptance.
      await notifyUser(rideRequest.seekerId, 'ride_request_accepted', {
        rideId: rideRequest.rideId,
        requestId: id
      });

      return NextResponse.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof InsufficientSeatsError) {
        return Response.json(
          { ok: false, error: 'Not enough seats available to accept this request.' },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride request acceptance failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
