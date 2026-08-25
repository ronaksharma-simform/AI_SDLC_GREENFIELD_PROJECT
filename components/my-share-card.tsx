'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupees } from '@/lib/format-money';
import { formatDateTime } from '@/lib/format-date';

interface MyShare {
  shareAmount: number | null;
  paymentStatus: string;
  paidAt: string | null;
}

/**
 * Read-only card shown to a Seeker whose request was Accepted on a completed
 * ride: their frozen share and whether they have settled (PAY-8). It renders
 * nothing until the API confirms the caller has an Accepted relationship to the
 * ride, so unrelated riders and riders on rides without a cost never see it.
 */
export function MyShareCard({ rideId }: { rideId: string }) {
  const [share, setShare] = useState<MyShare | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rides/${rideId}/cost-split`);
        const body = await res.json();
        if (res.ok && body.ok && body.costSplit?.myShare != null && !cancelled) {
          setShare(body.costSplit.myShare as MyShare);
        }
      } catch {
        // Not an accepted share (or no cost) — render nothing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  if (!share) return null;

  const paid = share.paymentStatus === 'PAID';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Your share</CardTitle>
        <CardDescription>The ride is complete — this is your portion of the trip cost.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-bold tracking-tight">{formatRupees(share.shareAmount)}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {paid ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-medium text-success">Paid</span>
              {share.paidAt ? ` · ${formatDateTime(share.paidAt)}` : ''}
            </>
          ) : (
            <span>Unpaid — settle with the driver</span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
