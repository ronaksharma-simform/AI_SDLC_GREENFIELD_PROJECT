import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { computeCostPerSeat } from '@/lib/payments';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/rides/{id}/settlement
 *
 * Provider-only: full settlement summary for a completed ride they own
 * (PAY-7). Lists every Seeker whose request was Accepted, with their frozen
 * `shareAmount` and `paymentStatus`, so the Provider can track who has settled
 * off-platform (§7 / §11.5).
 *
 * Responses:
 *   - 200 { ok: true, settlement }  on success
 *   - 400 { ok: false, error }      malformed ride id, ride not completed, or no
 *                                   cost split declared
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found / not owned by the caller
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
    if (!ride || ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    if (ride.status !== 'COMPLETED') {
      return Response.json(
        { ok: false, error: 'Settlement is available after the ride is completed.' },
        { status: 400 }
      );
    }

    if (ride.totalCost == null) {
      return Response.json(
        { ok: false, error: 'This ride has no declared trip cost to settle.' },
        { status: 400 }
      );
    }

    const requests = await prisma.rideRequest.findMany({
      where: { rideId: id, status: 'ACCEPTED' },
      include: { seeker: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json({
      ok: true,
      settlement: {
        totalCost: Number(ride.totalCost),
        costPerSeat: computeCostPerSeat(ride.totalCost, requests.length),
        costFinalizedAt: ride.costFinalizedAt,
        rows: requests.map((request) => ({
          requestId: request.id,
          seekerId: request.seeker.id,
          seekerName: request.seeker.name ?? request.seeker.email,
          seatsRequested: request.seatsRequested,
          shareAmount: request.shareAmount != null ? Number(request.shareAmount) : null,
          paymentStatus: request.paymentStatus,
          paidAt: request.paidAt
        }))
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Settlement fetch failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
