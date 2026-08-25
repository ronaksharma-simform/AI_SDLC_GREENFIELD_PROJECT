/**
 * Pure helpers for the Ride Feed view (Part A). Building the query string is
 * kept in a small, side-effect-free module so the filter → request mapping is
 * unit-testable without rendering a component.
 */

/** A selected location, structurally matching `LocationValue` from the picker. */
export interface RideFeedLocation {
  latitude: number;
  longitude: number;
  address: string;
  placeId?: string;
}

export interface RideFeedFilters {
  /** Pickup point — also carries the proximity coordinates for the backend. */
  source?: RideFeedLocation | null;
  /** Drop-off point. */
  destination?: RideFeedLocation | null;
  /** Desired departure time as a `datetime-local` value. */
  time?: string;
  /** Number of seats needed (string from a number input). */
  seats?: string;
}

/**
 * Builds the query string for `GET /api/rides/feed` from the filter bar state.
 *
 * - The source location supplies both the free-text `source` route filter and
 *   the `lat`/`lng` pickup coordinates that drive the backend proximity filter
 *   (the backend applies the default radius / time window — Part B §8).
 * - An unresolved source address still sends its coordinates so proximity
 *   keeps working even when reverse geocoding failed.
 * - Invalid or empty values are dropped rather than sent as garbage.
 */
export function buildRideFeedQuery(filters: RideFeedFilters): string {
  const params = new URLSearchParams();

  const source = filters.source;
  if (source) {
    if (source.address && source.address.trim()) {
      params.set('source', source.address.trim());
    }
    params.set('lat', String(source.latitude));
    params.set('lng', String(source.longitude));
  }

  const destination = filters.destination;
  if (destination?.address && destination.address.trim()) {
    params.set('destination', destination.address.trim());
  }

  if (filters.time) {
    const date = new Date(filters.time);
    if (!Number.isNaN(date.getTime())) {
      params.set('time', date.toISOString());
    }
  }

  if (filters.seats) {
    const seats = Number(filters.seats);
    if (Number.isInteger(seats) && seats >= 1) {
      params.set('seats', String(seats));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}
