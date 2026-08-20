/**
 * Small display helper for ride timestamps.
 *
 * Rides are stored in UTC (`Timestamptz`); rendering them in the server
 * component with an explicit locale keeps the list and detail pages consistent
 * regardless of the browser's locale.
 */
export function formatDateTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
