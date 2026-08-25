import { Badge } from '@/components/ui/badge';
import { requestStatusLabel, requestStatusVariant } from '@/lib/request-status';

/**
 * Color-coded ride-request status badge, shared across My Requests, Incoming
 * Requests, and the Ride Detail view so statuses render identically everywhere.
 */
export function RequestStatusBadge({ status }: { status: string }) {
  return <Badge variant={requestStatusVariant(status)}>{requestStatusLabel(status)}</Badge>;
}
