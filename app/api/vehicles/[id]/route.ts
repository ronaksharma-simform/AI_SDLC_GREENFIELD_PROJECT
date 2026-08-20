import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { vehicleSchema } from '@/lib/validation';

/**
 * GET /api/vehicles/[id]
 *
 * Returns a single vehicle, but ONLY if it belongs to the signed-in user
 * (ownership guard, VEH-7). Any other vehicle — including a non-existent id or
 * a vehicle owned by a different user — is indistinguishable and returns 404.
 *
 * Responses:
 *   - 200 { ok: true, vehicle }  on success
 *   - 401 { ok: false, error }   no valid session
 *   - 404 { ok: false, error }   vehicle not found or not owned
 */
export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const vehicle = await getOwnedVehicle(id, session.user.id);
  if (!vehicle) {
    return Response.json({ ok: false, error: 'Vehicle not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, vehicle });
}

/**
 * PATCH /api/vehicles/[id]
 *
 * Updates a single vehicle owned by the signed-in user. Accepts a JSON body
 * containing ANY subset of the vehicle fields (validated against a partial
 * `vehicleSchema`); only the provided fields are updated. Ownership is enforced
 * with the same guard as GET, so updating another user's vehicle returns 404.
 *
 * Responses:
 *   - 200 { ok: true, vehicle }  on success (the updated vehicle)
 *   - 400 { ok: false, error, details? }  malformed JSON or failed validation
 *   - 401 { ok: false, error }   no valid session
 *   - 404 { ok: false, error }   vehicle not found or not owned
 *   - 409 { ok: false, error }   license plate already registered (P2002)
 *   - 500 { ok: false, error }   unexpected failure
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const owned = await getOwnedVehicle(id, session.user.id);
  if (!owned) {
    return Response.json({ ok: false, error: 'Vehicle not found.' }, { status: 404 });
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

  const parsed = vehiclePatchSchema.safeParse(body);
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
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: parsed.data
    });

    return NextResponse.json({ ok: true, vehicle });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { ok: false, error: 'A vehicle with this license plate already exists.' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line no-console
    console.error('Vehicle update failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * DELETE /api/vehicles/[id]
 *
 * Deletes a single vehicle owned by the signed-in user. Ownership is enforced
 * with the same guard as GET/PATCH (VEH-7), so a vehicle that does not belong
 * to the caller — or does not exist at all — is indistinguishable and returns
 * 404, and is never deleted.
 *
 * Responses:
 *   - 200 { ok: true, vehicle }  on success (the deleted vehicle)
 *   - 401 { ok: false, error }   no valid session
 *   - 404 { ok: false, error }   vehicle not found or not owned
 *   - 500 { ok: false, error }   unexpected failure
 */
export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const owned = await getOwnedVehicle(id, session.user.id);
  if (!owned) {
    return Response.json({ ok: false, error: 'Vehicle not found.' }, { status: 404 });
  }

  try {
    const vehicle = await prisma.vehicle.delete({
      where: { id }
    });

    return NextResponse.json({ ok: true, vehicle });
  } catch (error) {
    // The row could disappear between the ownership check and the delete
    // (e.g. a concurrent request). Treat that as "not found" too.
    if (isRecordNotFoundError(error)) {
      return Response.json({ ok: false, error: 'Vehicle not found.' }, { status: 404 });
    }

    // eslint-disable-next-line no-console
    console.error('Vehicle deletion failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Ownership guard (VEH-7).
 *
 * Returns the vehicle matching `id` AND `ownerId`, or `null` when no such
 * vehicle exists. Reusing this single helper for both GET and PATCH guarantees
 * a user can only read or modify their own vehicles. Any database error
 * (e.g. an id that is not a valid UUID) is treated as "not found".
 *
 * Deliberately not exported: Next.js route modules may only export HTTP methods
 * (GET/PATCH/...) and route segment config.
 */
async function getOwnedVehicle(id: string, ownerId: string) {
  try {
    return await prisma.vehicle.findFirst({
      where: { id, ownerId }
    });
  } catch {
    return null;
  }
}

/** Partial validation schema for PATCH — every vehicle field is optional. */
const vehiclePatchSchema = vehicleSchema.partial();

/** Prisma exposes unique-constraint violations as error code P2002. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** Prisma exposes record-not-found (delete/update/deleteMany) as error code P2025. */
function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  );
}
