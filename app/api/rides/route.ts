import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rideCreateSchema } from '@/lib/validation';

/**
 * GET /api/rides
 *
 * Lists the signed-in user's own created rides (REQ-4 / REQ-8), ordered by
 * upcoming departure time. Only rides where the session user is the provider
 * are ever returned.
 *
 * Responses:
 *   - 200 { ok: true, rides }   on success
 *   - 401 { ok: false, error }  no valid session
 *   - 500 { ok: false, error }  unexpected failure
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const rides = await prisma.ride.findMany({
      where: { providerId: session.user.id },
      include: { vehicle: true },
      orderBy: { departureTime: 'asc' }
    });

    return NextResponse.json({ ok: true, rides });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride listing failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/rides
 *
 * Creates a ride owned by the signed-in user (REQ-1 / REQ-2). The vehicle is
 * re-verified server-side: it must exist and belong to the session user (REQ-5).
 * The offered seat count can never exceed the vehicle's physical seat capacity
 * (REQ-7) and the departure time must be in the future (REQ-6).
 *
 * Accepts a JSON body:
 *   { "vehicleId": uuid, "source": string, "destination": string,
 *     "departureTime": date, "seatsTotal": number (1..capacity), "notes"?: string }
 *
 * Responses:
 *   - 201 { ok: true, ride }       on success (ride includes its vehicle)
 *   - 400 { ok: false, error, details? }  malformed JSON, failed validation, or an
 *                                      unusable vehicle (not found / not owned /
 *                                      seats exceed capacity)
 *   - 401 { ok: false, error }     no valid session
 *   - 500 { ok: false, error }     unexpected failure
 */
export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
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

  const parsed = rideCreateSchema.safeParse(body);
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

  const { vehicleId, source, destination, departureTime, seatsTotal, notes } = parsed.data;

  try {
    // Never trust a client-submitted vehicle reference: re-verify ownership now.
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

    if (!vehicle) {
      return Response.json(
        { ok: false, error: 'Selected vehicle not found.' },
        { status: 400 }
      );
    }

    if (vehicle.ownerId !== session.user.id) {
      return Response.json(
        { ok: false, error: 'You can only offer rides with a vehicle you own.' },
        { status: 400 }
      );
    }

    if (seatsTotal > vehicle.seatCapacity) {
      return Response.json(
        {
          ok: false,
          error: `Seats must not exceed the vehicle's capacity of ${vehicle.seatCapacity}.`
        },
        { status: 400 }
      );
    }

    const ride = await prisma.ride.create({
      data: {
        providerId: session.user.id,
        vehicleId,
        source,
        destination,
        departureTime,
        seatsTotal,
        seatsAvailable: seatsTotal,
        status: 'ACTIVE',
        notes: notes ?? null
      },
      include: { vehicle: true }
    });

    return NextResponse.json({ ok: true, ride }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride creation failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
