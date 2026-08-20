import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { vehicleSchema } from '@/lib/validation';

/**
 * POST /api/vehicles
 *
 * Creates a vehicle owned by the signed-in user. Requires a valid session
 * (JWT). Accepts a JSON body:
 *   {
 *     "make": string, "model": string, "year": number,
 *     "color"?: string, "licensePlate": string,
 *     "seatCapacity": number (1-8), "vehicleType": VehicleType
 *   }
 *
 * Responses:
 *   - 201 { ok: true, vehicle }       on success (ownerId is taken from the session)
 *   - 400 { ok: false, error, details? }  malformed JSON or failed validation
 *   - 401 { ok: false, error }        no valid session
 *   - 409 { ok: false, error }        license plate already registered (P2002)
 *   - 500 { ok: false, error }        unexpected failure
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

  const parsed = vehicleSchema.safeParse(body);
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

  const { make, model, year, color, licensePlate, seatCapacity, vehicleType } = parsed.data;

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId: session.user.id,
        make,
        model,
        year,
        color: color ?? null,
        licensePlate,
        seatCapacity,
        vehicleType
      }
    });

    return NextResponse.json({ ok: true, vehicle }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { ok: false, error: 'A vehicle with this license plate already exists.' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line no-console
    console.error('Vehicle creation failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/** Prisma exposes unique-constraint violations as error code P2002. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
