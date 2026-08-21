import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { notifyUser } from '@/lib/notifications';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/requests/{id}/reject
 *
 * Provider-only: rejects a Pending request (REQ-17 / REQ-18).
 *
 * On reject:
 *   - the request becomes REJECTED and is stamped with `respondedAt`;
 *   - seat availability is unchanged (Section 9) — nothing was reserved;
 *   - the Seeker is notified of the outcome (REQ-19d);
 *   - other pending requests on the same ride are not affected (Section 9).
 *
 * A request that does not exist, or whose ride belongs to another user, both
 * resolve to 404 (Section 10 — Access Control).
 *
 * Responses:
 *   - 200 { ok: true, request }     on success
 *   - 400 { ok: false, error }      malformed request id
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      request not found / not for a ride owned by the caller
 *   - 409 { ok: false, error }      request is no longer pending
 *   - 500 { ok: false, error }      unexpected failure
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
      include: { ride: { select: { providerId: true } } }
    });

    if (!rideRequest || rideRequest.ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Request not found.' }, { status: 404 });
    }

    if (rideRequest.status !== 'PENDING') {
      return Response.json(
        { ok: false, error: 'Only a pending request can be rejected.' },
        { status: 409 }
      );
    }

    const updated = await prisma.rideRequest.update({
      where: { id },
      data: { status: 'REJECTED', respondedAt: new Date() }
    });

    // REQ-19d: the Seeker is notified of the rejection.
    await notifyUser(rideRequest.seekerId, 'RideRequestRejected', {
      rideId: rideRequest.rideId,
      requestId: id
    });

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride request rejection failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
