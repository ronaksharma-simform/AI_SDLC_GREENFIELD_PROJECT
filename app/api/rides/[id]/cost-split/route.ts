import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { computeCostPerSeat } from '@/lib/payments';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/rides/{id}/cost-split
 *
 * Returns the per-seat split for a ride, scoped to the caller's relationship
 * to it (PAY-3 / §15):
 *
 *   - the ride's Provider may always read it;
 *   - a Seeker with a Pending or Accepted request may read it (and, once their
 *     request is Accepted, their own frozen share via `myShare`);
 *   - any other user gets a 404 — unrelated riders never see the split.
 *
 * Pre-completion the split is `live` (recomputed from the current number of
 * Accepted requests); post-completion it is `frozen` at the value written to
 * `shareAmount` at ride completion (PAY-4/PAY-5). Rides without a declared
 * `totalCost` return a null-shaped payload (PAY-9).
 *
 * Responses:
 *   - 200 { ok: true, costSplit }   on success
 *   - 400 { ok: false, error }      malformed ride id
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found, or caller has no Pending/Accepted
 *                                   relationship to the ride
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

    const callerIsProvider = ride.providerId === session.user.id;

    // A non-provider must hold a Pending or Accepted request to see any split
    // data (PAY-3). Missing ride + no relationship both resolve to 404.
    let activeRequest: {
      status: string;
      shareAmount: unknown;
      paymentStatus: string;
      paidAt: Date | null;
    } | null = null;
    let allowed = callerIsProvider;
    if (!allowed) {
      activeRequest = await prisma.rideRequest.findFirst({
        where: {
          rideId: id,
          seekerId: session.user.id,
          status: { in: ['PENDING', 'ACCEPTED'] }
        },
        select: { status: true, shareAmount: true, paymentStatus: true, paidAt: true }
      });
      allowed = activeRequest != null;
    }
    if (!allowed) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    // PAY-9: no declared cost — no split data at all.
    if (ride.totalCost == null) {
      return NextResponse.json({
        ok: true,
        costSplit: {
          totalCost: null,
          costPerSeat: null,
          acceptedCount: 0,
          status: null,
          costFinalizedAt: null,
          myShare: null
        }
      });
    }

    const acceptedRequests = await prisma.rideRequest.findMany({
      where: { rideId: id, status: 'ACCEPTED' },
      select: { id: true, shareAmount: true }
    });
    const acceptedCount = acceptedRequests.length;

    let costPerSeat: number;
    let status: 'live' | 'frozen';
    if (ride.costFinalizedAt != null) {
      // PAY-5: once frozen, never recompute — read the written shareAmount.
      const frozen = acceptedRequests.find((request) => request.shareAmount != null);
      costPerSeat =
        frozen != null
          ? Number(frozen.shareAmount)
          : computeCostPerSeat(ride.totalCost, acceptedCount);
      status = 'frozen';
    } else {
      // PAY-2: live split recomputed on read from the current Accepted count.
      costPerSeat = computeCostPerSeat(ride.totalCost, acceptedCount);
      status = 'live';
    }

    // PAY-8: a Seeker sees only their own frozen share/payment status — never
    // the full roster (enforced server-side, not just hidden in the UI).
    let myShare: {
      shareAmount: number | null;
      paymentStatus: string;
      paidAt: Date | null;
    } | null = null;
    if (activeRequest?.status === 'ACCEPTED') {
      myShare = {
        shareAmount: activeRequest.shareAmount != null ? Number(activeRequest.shareAmount) : null,
        paymentStatus: activeRequest.paymentStatus,
        paidAt: activeRequest.paidAt
      };
    }

    return NextResponse.json({
      ok: true,
      costSplit: {
        totalCost: Number(ride.totalCost),
        costPerSeat,
        acceptedCount,
        status,
        costFinalizedAt: ride.costFinalizedAt,
        myShare
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Cost split fetch failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
