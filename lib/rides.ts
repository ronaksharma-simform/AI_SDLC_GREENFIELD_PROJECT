/**
 * Shared helpers for the Ride Creation (Offer Ride) module.
 */

/**
 * A ride becomes "locked" once any seat has been accepted — i.e. once
 * `seatsAvailable` drops below `seatsTotal`. The Ride Request Handling module
 * owns the decrement of `seatsAvailable`; this module uses the resulting
 * difference to decide which fields a provider may still edit (REQ-9).
 */
export function isRideLocked(ride: { seatsAvailable: number; seatsTotal: number }): boolean {
  return ride.seatsAvailable < ride.seatsTotal;
}

/**
 * Cheap shape check for route path params before handing them to Prisma. Prisma
 * throws on a malformed UUID, so we reject invalid ids with a clean 400 instead.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
