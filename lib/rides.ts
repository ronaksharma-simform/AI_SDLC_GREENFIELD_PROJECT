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

/**
 * A pair of coordinates used for the source/destination "same point" check.
 */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/**
 * Minimum distance (in meters) that a ride's source and destination must be
 * apart. Pickup and destination resolving to the same (or an effectively
 * identical) point is rejected so a ride always spans a real route (Section 8 —
 * Validation Rules).
 */
export const MIN_LOCATION_DISTANCE_METERS = 50;

/**
 * Great-circle distance between two coordinates in meters (haversine formula).
 * Used to decide whether a source and destination resolve to the same point.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusMeters = 6371000;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * True when two locations are within `MIN_LOCATION_DISTANCE_METERS` of each
 * other (or are the exact same point).
 */
export function areLocationsTooClose(a: LatLng, b: LatLng): boolean {
  return distanceMeters(a, b) < MIN_LOCATION_DISTANCE_METERS;
}
