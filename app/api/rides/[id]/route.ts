import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { rideUpdateSchema } from '@/lib/validation';
import { isRideLocked, isValidUuid } from '@/lib/rides';

type RouteContext = { params: Promise<{ id: string }> };

/** Returns the validated, ownership-checked ride or a NextResponse error. */
async function getOwnedRide(id: string, userId: string) {
  const ride = await prisma.ride.findUnique({
    where: { id },
    include: { vehicle: true }
  });

  if (!ride || ride.providerId !== userId) {
    return { error: Response.json({ ok: false, error: 'Ride not found.' }, { status: 404 }) };
  }

  return { ride };
}

/**
 * GET /api/rides/{id}
 *
 * Returns a single ride, but only to its owner. A ride that does not exist and
 * a ride that belongs to someone else both resolve to the same 404 so we never
 * confirm the existence of another user's ride (Section 10 — Access Control).
 *
 * Responses:
 *   - 200 { ok: true, ride }       on success
 *   - 400 { ok: false, error }     malformed ride id
 *   - 401 { ok: false, error }     no valid session
 *   - 404 { ok: false, error }     ride not found / not owned by the caller
 *   - 500 { ok: false, error }     unexpected failure
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
    const result = await getOwnedRide(id, session.user.id);
    if ('error' in result) return result.error;

    return NextResponse.json({ ok: true, ride: result.ride });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride fetch failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * PATCH /api/rides/{id}
 *
 * Updates a ride the caller owns. Core details (vehicle, seat count, departure
 * time) become locked once any seat has been accepted (REQ-9) — those edits then
 * return 409 so a Seeker's confirmed seat can never be invalidated. Non-critical
 * fields (source, destination, notes) remain editable.
 *
 * While unlocked, edits are validated exactly like creation: the vehicle (when
 * changed) must belong to the caller, and the resulting seat count can never
 * exceed the selected vehicle's capacity.
 *
 * Responses:
 *   - 200 { ok: true, ride }        on success
 *   - 400 { ok: false, error, details? }  malformed id/JSON, failed validation,
 *                                        or an unusable vehicle
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found / not owned by the caller
 *   - 409 { ok: false, error }      edit to a locked core field
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

  const parsed = rideUpdateSchema.safeParse(body);
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

  const input = parsed.data;

  try {
    const result = await getOwnedRide(id, session.user.id);
    if ('error' in result) return result.error;

    const ride = result.ride;

    // REQ-9: once a seat has been accepted, core details are locked.
    if (isRideLocked(ride)) {
      const touchesCore =
        input.vehicleId !== undefined ||
        input.seatsTotal !== undefined ||
        input.departureTime !== undefined;

      if (touchesCore) {
        return Response.json(
          {
            ok: false,
            error: 'Ride details are locked because a seat has already been accepted.'
          },
          { status: 409 }
        );
      }
    }

    const data: Prisma.RideUncheckedUpdateInput = {};

    if (input.source !== undefined) data.source = input.source;
    if (input.destination !== undefined) data.destination = input.destination;
    if (input.notes !== undefined) data.notes = input.notes;

    // Determine the vehicle that will serve the ride after this edit.
    let targetVehicle = ride.vehicle;
    if (input.vehicleId !== undefined) {
      const candidate = await prisma.vehicle.findUnique({ where: { id: input.vehicleId } });

      if (!candidate) {
        return Response.json(
          { ok: false, error: 'Selected vehicle not found.' },
          { status: 400 }
        );
      }

      if (candidate.ownerId !== session.user.id) {
        return Response.json(
          { ok: false, error: 'You can only offer rides with a vehicle you own.' },
          { status: 400 }
        );
      }

      targetVehicle = candidate;
      data.vehicleId = input.vehicleId;
    }

    // The resulting seat count can never exceed the (new) vehicle's capacity.
    const resultingSeatsTotal = input.seatsTotal ?? ride.seatsTotal;
    if (resultingSeatsTotal > targetVehicle.seatCapacity) {
      return Response.json(
        {
          ok: false,
          error: `Seats must not exceed the vehicle's capacity of ${targetVehicle.seatCapacity}.`
        },
        { status: 400 }
      );
    }

    if (input.seatsTotal !== undefined) {
      data.seatsTotal = input.seatsTotal;
      // No seats are accepted at this point (the lock check above passed), so
      // available seats track the total.
      data.seatsAvailable = input.seatsTotal;
    }

    if (input.departureTime !== undefined) {
      data.departureTime = input.departureTime;
    }

    const rideUpdated = await prisma.ride.update({
      where: { id },
      data,
      include: { vehicle: true }
    });

    return NextResponse.json({ ok: true, ride: rideUpdated });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride update failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * DELETE /api/rides/{id}
 *
 * Cancels a ride the caller owns. Cancellation is a status change, never a hard
 * delete, so ride history is preserved for reporting, disputes, and rating
 * context. Cancelling an already-cancelled ride is a no-op; a completed ride
 * cannot be cancelled.
 *
 * Responses:
 *   - 200 { ok: true, ride }        on success (ride.status === CANCELLED)
 *   - 400 { ok: false, error }      malformed ride id
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      ride not found / not owned by the caller
 *   - 409 { ok: false, error }      the ride is already completed
 *   - 500 { ok: false, error }      unexpected failure
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid ride ID.' }, { status: 400 });
  }

  try {
    const result = await getOwnedRide(id, session.user.id);
    if ('error' in result) return result.error;

    const ride = result.ride;

    if (ride.status === 'CANCELLED') {
      // Idempotent: nothing to do.
      return NextResponse.json({ ok: true, ride });
    }

    if (ride.status === 'COMPLETED') {
      return Response.json(
        { ok: false, error: 'A completed ride cannot be cancelled.' },
        { status: 409 }
      );
    }

    const cancelled = await prisma.ride.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    return NextResponse.json({ ok: true, ride: cancelled });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Ride cancellation failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
