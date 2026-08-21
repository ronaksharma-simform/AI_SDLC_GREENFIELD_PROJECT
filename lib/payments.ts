import { prisma } from '@/lib/prisma';

/**
 * Shared helpers for the Payment & Cost-Splitting module (fare calculation &
 * settlement tracking).
 *
 * The module never moves money — it computes an equal split of a Provider's
 * optional total trip cost and records the Provider's manual confirmation that
 * each Seeker settled off-platform (cash, UPI, etc.). See the module spec §9–§14.
 */

/**
 * Computes the per-occupant share of a trip cost, in the smallest currency unit
 * (paise), rounded UP to the nearest subunit so the sum of shares never falls
 * short of the declared total; any surplus is absorbed by the Provider (§12).
 *
 * The cost is split evenly across everyone in the vehicle: the Provider plus
 * every currently-Accepted Seeker (PAY-2). Note the divisor is the number of
 * *Seekers* whose requests were accepted, not the total seat count — a rider
 * counts once regardless of how many seats they hold.
 *
 * @param totalCost            the declared trip cost in paise
 * @param acceptedRequestCount number of currently-Accepted ride requests
 * @returns                    the per-person share in paise (0 for an invalid
 *                             non-positive cost)
 */
export function computeCostPerSeat(
  totalCost: number | string | { toString(): string },
  acceptedRequestCount: number
): number {
  const cost = Number(totalCost);
  if (!Number.isFinite(cost) || cost <= 0) return 0;

  const occupants = 1 + Math.max(0, Math.floor(acceptedRequestCount));
  return Math.ceil(cost / occupants);
}

/**
 * Snapshots the final cost split at ride completion (PAY-4 / PAY-5).
 *
 * When a ride with a declared `totalCost` transitions to Completed, this:
 *   1. writes `costPerSeat` as `shareAmount` on every currently-Accepted request,
 *   2. sets the ride's `costFinalizedAt`, freezing `totalCost` from further edits.
 *
 * It is idempotent: a ride that already has `costFinalizedAt` set (or no cost at
 * all) is a no-op, so a repeated completion trigger cannot recompute or clobber
 * a frozen settlement record (§14).
 */
export async function finalizeRideSettlement(rideId: string): Promise<void> {
  const [ride, acceptedRequests] = await Promise.all([
    prisma.ride.findUnique({
      where: { id: rideId },
      select: { totalCost: true, costFinalizedAt: true }
    }),
    prisma.rideRequest.findMany({
      where: { rideId, status: 'ACCEPTED' },
      select: { id: true }
    })
  ]);

  if (!ride || ride.totalCost == null || ride.costFinalizedAt != null) {
    return;
  }

  const share = computeCostPerSeat(ride.totalCost, acceptedRequests.length);

  await prisma.$transaction([
    prisma.rideRequest.updateMany({
      where: { rideId, status: 'ACCEPTED' },
      data: { shareAmount: share }
    }),
    prisma.ride.update({
      where: { id: rideId },
      data: { costFinalizedAt: new Date() }
    })
  ]);
}
