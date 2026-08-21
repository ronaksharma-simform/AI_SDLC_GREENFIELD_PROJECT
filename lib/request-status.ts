/**
 * Shared display helpers for ride-request statuses (Part A — My Requests /
 * Incoming Requests / Ride Detail). Kept in one place so the badge rendering
 * stays consistent across all four views.
 */

export type RideRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type RequestStatusVariant = 'secondary' | 'success' | 'destructive' | 'outline';

/** Human-readable labels for the color-coded status badges. */
export const REQUEST_STATUS_LABELS: Record<RideRequestStatus, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
};

/**
 * Badge variants follow the Part A spec:
 * Pending (neutral) → secondary, Accepted (positive) → success,
 * Rejected (negative) → destructive, Cancelled (muted) → outline.
 */
export const REQUEST_STATUS_VARIANTS: Record<RideRequestStatus, RequestStatusVariant> = {
  PENDING: 'secondary',
  ACCEPTED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'outline'
};

export function requestStatusLabel(status: string): string {
  return REQUEST_STATUS_LABELS[status as RideRequestStatus] ?? status;
}

export function requestStatusVariant(status: string): RequestStatusVariant {
  return REQUEST_STATUS_VARIANTS[status as RideRequestStatus] ?? 'secondary';
}
