/**
 * Shared helpers for the Trip Start & Live Location Tracking module
 * (Sections 10 / 11 / 12 of the spec).
 *
 * The backend is the source of truth for the trip lifecycle rules; the frontend
 * only reports raw device position at a controlled interval. These pure helpers
 * keep the lifecycle rules (what statuses may start / accept location updates /
 * be completed) unit-testable without a database.
 */

/**
 * A trip may only be started from a bookable state — a ride that is still
 * Active (departing without a full car) or already Full. Starting an
 * In-Progress, Completed, or Cancelled ride is rejected (Section 11).
 */
export function canStartTrip(status: string): boolean {
  return status === 'ACTIVE' || status === 'FULL';
}

/**
 * Location updates are only accepted while a trip is In Progress. Updates
 * submitted outside this state are rejected (Section 11), and broadcasting
 * stops unconditionally the moment the ride leaves InProgress (Section 12).
 */
export function canAcceptLocationUpdates(status: string): boolean {
  return status === 'IN_PROGRESS';
}

/**
 * A trip may only be completed while it is In Progress — completing a ride that
 * has not been started is rejected (Section 11).
 */
export function canCompleteTrip(status: string): boolean {
  return status === 'IN_PROGRESS';
}

/**
 * Minimum interval, in milliseconds, between server-accepted location updates
 * (Section 12 — Business Rules). The Provider's client is designed to report
 * every 5–10 seconds, but a misbehaving client must be rate-limited
 * server-side independent of whatever interval the frontend uses.
 */
export const MIN_LOCATION_UPDATE_INTERVAL_MS = 2000;

/**
 * How often (in milliseconds) a snapshot is written to the Trip Location History
 * table. Snapshots are intentionally much less frequent than live updates
 * (Section 10.2: "every 30–60 seconds, not every update").
 */
export const LOCATION_SNAPSHOT_INTERVAL_MS = 30_000;

/**
 * How long (in milliseconds) a Seeker's UI waits without a fresh location
 * update before showing a staleness indicator rather than implying the marker
 * is current (REQ-9). Defaults to 45 seconds, within the spec's 30–60s window.
 */
export const LOCATION_STALE_AFTER_MS = 45_000;

/**
 * True when the Provider's last reported position is older than `timeoutMs`,
 * i.e. the UI should indicate the marker is stale rather than live (REQ-9).
 *
 * A ride with no location yet (or no In-Progress trip) is treated as stale —
 * there is no fresh position to show.
 */
export function isLocationStale(
  locationUpdatedAt: Date | string | null | undefined,
  now: Date = new Date(),
  timeoutMs: number = LOCATION_STALE_AFTER_MS
): boolean {
  if (locationUpdatedAt == null) return true;
  const updatedAt = typeof locationUpdatedAt === 'string' ? new Date(locationUpdatedAt) : locationUpdatedAt;
  return now.getTime() - updatedAt.getTime() >= timeoutMs;
}

/**
 * Number of seconds since the last location update, rounded down. Used by the
 * "Last updated Xs ago" indicator (REQ-9). Returns `null` when no update exists.
 */
export function secondsSinceLastUpdate(
  locationUpdatedAt: Date | string | null | undefined,
  now: Date = new Date()
): number | null {
  if (locationUpdatedAt == null) return null;
  const updatedAt = typeof locationUpdatedAt === 'string' ? new Date(locationUpdatedAt) : locationUpdatedAt;
  return Math.max(0, Math.floor((now.getTime() - updatedAt.getTime()) / 1000));
}
