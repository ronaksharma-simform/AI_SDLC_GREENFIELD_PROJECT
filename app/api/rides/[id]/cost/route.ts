import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { rideCostSchema } from '@/lib/validation';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/rides/{id}/cost
 *
 * Provider-only: declares, updates, or clears the ride's optional total trip
 * cost (PAY-1). The cost is stored in the smallest currency unit (paise) and
 * may be changed any time before the ride is Completed (PAY-5).
 *
 * Body: `{ "totalCost": <positive integer paise> | null }`
 *   - a positive integer of paise sets the cost;
 *   - `null` clears it, making cost-splitting inert again (PAY-9);
 *   - zero or negative amounts are rejected (§12).
 *
 * Responses:
 *   - 200 { ok: true, ride }        on success (ride carries totalCost)
 *   - 400 { ok: false, error, details? }  malformed id/JSON or failed validation
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found / not owned by the caller
 *   - 409 { ok: false, error }      ride is already completed (split frozen)
 *   - 500 { ok: false, error }      unexpected failure
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid ride ID.' }, { status: 400 });
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

  const parsed = rideCostSchema.safeParse(body);
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
    const ride = await prisma.ride.findUnique({ where: { id } });
    if (!ride || ride.providerId !== session.user.id) {
      return Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 });
    }

    if (ride.costFinalizedAt != null) {
      return Response.json(
        { ok: false, error: 'Trip cost is locked because the ride is completed.' },
        { status: 409 }
      );
    }

    const updated = await prisma.ride.update({
      where: { id },
      data: { totalCost: parsed.data.totalCost }
    });

    return NextResponse.json({ ok: true, ride: updated });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride cost update failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
