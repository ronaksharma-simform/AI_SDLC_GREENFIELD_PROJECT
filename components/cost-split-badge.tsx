'use client';

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { formatRupees } from '@/lib/format-money';

interface CostSplit {
  costPerSeat: number | null;
  status: 'live' | 'frozen' | null;
  acceptedCount: number;
}

/**
 * Small "≈ ₹X / person" badge shown to the ride Provider and to Seekers with a
 * Pending/Accepted request (PAY-3). It reads the cost split through the API so
 * access control and the live-vs-frozen calculation stay server-side.
 *
 * Renders nothing when the ride has no declared trip cost (PAY-9), when the
 * caller has no relationship to the ride, or while loading.
 */
export function CostSplitBadge({ rideId }: { rideId: string }) {
  const [split, setSplit] = useState<CostSplit | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rides/${rideId}/cost-split`);
        const body = await res.json();
        if (res.ok && body.ok && !cancelled) {
          setSplit(body.costSplit as CostSplit);
        }
      } catch {
        // No split available — render nothing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  if (!split || split.costPerSeat == null) return null;

  return (
    <Badge variant={split.status === 'frozen' ? 'success' : 'secondary'}>
      ≈ {formatRupees(split.costPerSeat)}/person
      {split.status === 'live'
        ? split.acceptedCount > 0
          ? ' · updates as seats confirm'
          : ' · recalculates once seats confirm'
        : ' · finalized'}
    </Badge>
  );
}
