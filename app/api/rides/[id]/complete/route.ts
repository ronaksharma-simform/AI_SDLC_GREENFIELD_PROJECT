import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { canCompleteTrip } from '@/lib/trip-tracking';
import { closeConversationsForRide } from '@/lib/conversations';
import { finalizeRideSettlement } from '@/lib/payments';
import { notifyUser } from '@/lib/notifications';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/rides/{id}/complete
 *
 * Provider-only: marks one of the caller's rides as Completed.
 *
 * A trip can only be completed from the In Progress state (Section 11 —
 * Validation Rules): completing a ride that has not been started is rejected.
 * Completing stops location broadcasting immediately and unconditionally
 * (REQ-7), closes the ride's chat conversations (REQ-6), freezes any declared
 * cost split (PAY-4), and notifies every Accepted Seeker that the trip is
 * complete (Section 10.4).
 *
 * Completing an already-completed ride is a no-op; a cancelled ride cannot be
 * completed.
 *
 * Responses:
 *   - 200 { ok: true, ride }        on success (ride.status === COMPLETED)
 *   - 400 { ok: false, error }      malformed ride id
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found / not owned by the caller
 *   - 409 { ok: false, error }      the ride is cancelled or has not started
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

    if (ride.status === 'COMPLETED') {
      // Idempotent: nothing to do.
      return NextResponse.json({ ok: true, ride });
    }

    if (ride.status === 'CANCELLED') {
      return Response.json(
        { ok: false, error: 'A cancelled ride cannot be completed.' },
        { status: 409 }
      );
    }

    if (!canCompleteTrip(ride.status)) {
      return Response.json(
        { ok: false, error: 'A trip can only be completed after it has started.' },
        { status: 409 }
      );
    }

    const completed = await prisma.ride.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    // REQ-6: a completed ride closes its chat conversations — history remains
    // visible but no further messages can be sent.
    await closeConversationsForRide(id);

    // PAY-4: when the Provider declared a trip cost, snapshot the final equal
    // share onto every currently-Accepted request and freeze the split
    // (costFinalizedAt). Skipped when no cost was declared (PAY-9).
    if (ride.totalCost != null) {
      await finalizeRideSettlement(id);
    }

    // Section 10.4: every Accepted Seeker is notified the trip is complete.
    const acceptedRequests = await prisma.rideRequest.findMany({
      where: { rideId: id, status: 'ACCEPTED' },
      select: { seekerId: true }
    });

    await Promise.all(
      acceptedRequests.map((request) =>
        notifyUser(request.seekerId, 'TripCompleted', {
          rideId: id,
          destinationAddress: ride.destinationAddress
        })
      )
    );

    return NextResponse.json({ ok: true, ride: completed });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride completion failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
