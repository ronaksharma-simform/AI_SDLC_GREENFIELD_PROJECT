import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/requests/{id}/cancel
 *
 * Seeker-only: cancels one of the caller's own requests (REQ-19e / Section 6.5).
 *
 * - A Pending request is simply cancelled.
 * - An Accepted request is cancelled and the held seats are released back to
 *   the ride (`seatsAvailable` increases by `seatsRequested`, capped at
 *   `seatsTotal`); if the ride had been marked Full it is reopened (ACTIVE).
 * - A Rejected request cannot be cancelled (409).
 * - Cancelling an already-cancelled request is a no-op (200).
 *
 * A request that does not exist, or that was sent by another user, both resolve
 * to 404 (Section 10 — Access Control).
 *
 * Responses:
 *   - 200 { ok: true, request, ride? }  on success (ride included when seats were released)
 *   - 400 { ok: false, error }          malformed request id
 *   - 401 { ok: false, error }          no valid session
 *   - 404 { ok: false, error }          request not found / not owned by the caller
 *   - 409 { ok: false, error }          request has already been rejected
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

    if (!rideRequest || rideRequest.seekerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Request not found.' }, { status: 404 });
    }

    const { status } = rideRequest;

    if (status === 'REJECTED') {
      return Response.json(
        { ok: false, error: 'A rejected request cannot be cancelled.' },
        { status: 409 }
      );
    }

    if (status === 'CANCELLED') {
      // Idempotent: already cancelled.
      return NextResponse.json({ ok: true, request: rideRequest });
    }

    if (status === 'PENDING') {
      const updated = await prisma.rideRequest.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });
      return NextResponse.json({ ok: true, request: updated });
    }

    // status === 'ACCEPTED' — release the held seats back to the ride (6.5).
    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.rideRequest.update({
        where: { id },
        data: { status: 'CANCELLED' }
      });

      const freshRide = await tx.ride.findUnique({ where: { id: rideRequest.rideId } });
      if (!freshRide) return { request: updatedRequest, ride: null };

      const released = Math.min(
        freshRide.seatsTotal,
        freshRide.seatsAvailable + rideRequest.seatsRequested
      );

      const ride = await tx.ride.update({
        where: { id: rideRequest.rideId },
        data: {
          seatsAvailable: released,
          // Reopen the ride if this cancellation freed it up.
          status: freshRide.status === 'FULL' ? 'ACTIVE' : freshRide.status
        }
      });

      return { request: updatedRequest, ride };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride request cancellation failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
