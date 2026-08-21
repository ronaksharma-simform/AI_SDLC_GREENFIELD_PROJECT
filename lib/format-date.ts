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

/**
 * Compact relative timestamp for the notification dropdown ("2m ago").
 *
 * Rendered client-side so it stays fresh without a re-render; values older
 * than a week fall back to a short absolute date.
 */
export function formatRelativeTime(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const elapsedSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (elapsedSeconds < 60) return 'just now';

  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
