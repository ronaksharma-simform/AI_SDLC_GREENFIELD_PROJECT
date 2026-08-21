import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { paymentStatusUpdateSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/requests/{id}/payment
 *
 * Provider-only: marks a Seeker's frozen share as Paid (or reverts it to
 * Unpaid to correct a mistake) on a completed ride they own (PAY-6 / §11.4).
 *
 * The Provider is the sole authority on `paymentStatus` — a Seeker can never
 * self-report a share as paid, since the Provider is the one actually receiving
 * the off-platform payment (§14). Setting PAID stamps `paidAt`; reverting to
 * UNPAID clears it. Every other field on the request is untouched.
 *
 * Body: `{ "paymentStatus": "PAID" | "UNPAID" }`
 *
 * Responses:
 *   - 200 { ok: true, request }     on success
 *   - 400 { ok: false, error, details? }  malformed id/JSON or failed validation
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      request not found / not for a ride owned by the caller
 *   - 409 { ok: false, error }      request has no frozen share / ride not completed
 *   - 500 { ok: false, error }      unexpected failure
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid request ID.' }, { status: 400 });
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

  const parsed = paymentStatusUpdateSchema.safeParse(body);
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

  try {
    const rideRequest = await prisma.rideRequest.findUnique({
      where: { id },
      include: { ride: true }
    });

    if (!rideRequest || rideRequest.ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Request not found.' }, { status: 404 });
    }

    // Only an Accepted request on a completed ride with a frozen share may be
    // settled — a Provider can't pre-mark someone paid before the split exists.
    if (
      rideRequest.status !== 'ACCEPTED' ||
      rideRequest.shareAmount == null ||
      rideRequest.ride.status !== 'COMPLETED'
    ) {
      return Response.json(
        { ok: false, error: 'This request has no settlement to update.' },
        { status: 409 }
      );
    }

    const paymentStatus = parsed.data.paymentStatus;
    const updated = await prisma.rideRequest.update({
      where: { id },
      data: {
        paymentStatus,
        paidAt: paymentStatus === 'PAID' ? new Date() : null
      }
    });

    return NextResponse.json({ ok: true, request: updated });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Payment status update failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
