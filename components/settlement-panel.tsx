'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatRupees } from '@/lib/format-money';
import { formatDateTime } from '@/lib/format-date';

interface SettlementRow {
  requestId: string;
  seekerId: string;
  seekerName: string;
  seatsRequested: number;
  shareAmount: number | null;
  paymentStatus: 'UNPAID' | 'PAID';
  paidAt: string | null;
}

interface SettlementData {
  totalCost: number;
  costPerSeat: number;
  costFinalizedAt: string | null;
  rows: SettlementRow[];
}

/**
 * Provider-only settlement tracker for a completed ride (PAY-7 / §11.5). Lists
 * every Accepted Seeker with their frozen share and lets the Provider mark each
 * share as Paid/Unpaid off-platform (PAY-6). Updates optimistically and reverts
 * on failure.
 */
export function SettlementPanel({ rideId }: { rideId: string }) {
  const [data, setData] = useState<SettlementData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/rides/${rideId}/settlement`);
        const body = await res.json();
        if (res.ok && body.ok) {
          if (!cancelled) setData(body.settlement as SettlementData);
        } else if (!cancelled) {
          setError(body.error ?? 'Could not load the settlement.');
        }
      } catch {
        if (!cancelled) setError('Could not load the settlement.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  async function togglePayment(row: SettlementRow) {
    const next: SettlementRow['paymentStatus'] = row.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    const previous = { ...row };
    const optimistic = (rows: SettlementRow[]) =>
      rows.map((entry) =>
        entry.requestId === row.requestId
          ? {
              ...entry,
              paymentStatus: next,
              paidAt: next === 'PAID' ? new Date().toISOString() : null
            }
          : entry
      );

    setData((prev) => (prev ? { ...prev, rows: optimistic(prev.rows) } : prev));

    try {
      const res = await fetch(`/api/requests/${row.requestId}/payment`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentStatus: next })
      });
      if (!res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                rows: prev.rows.map((entry) =>
                  entry.requestId === row.requestId ? previous : entry
                )
              }
            : prev
        );
      }
    } catch {
      setData((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((entry) =>
                entry.requestId === row.requestId ? previous : entry
              )
            }
          : prev
      );
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading settlement…</CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const paidCount = data.rows.filter((row) => row.paymentStatus === 'PAID').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settlement</CardTitle>
        <CardDescription>
          {data.rows.length === 0
            ? 'No accepted seekers to settle.'
            : `${paidCount} of ${data.rows.length} paid · each share ${formatRupees(data.costPerSeat)}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.rows.length === 0 ? null : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seeker</TableHead>
                <TableHead className="text-right">Seats</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="text-right" aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.requestId}>
                  <TableCell className="font-medium">{row.seekerName}</TableCell>
                  <TableCell className="text-right">{row.seatsRequested}</TableCell>
                  <TableCell className="text-right">{formatRupees(row.shareAmount)}</TableCell>
                  <TableCell className="text-right">
                    {row.paymentStatus === 'PAID' ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        Paid
                        {row.paidAt ? ` ${formatDateTime(row.paidAt)}` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Circle className="h-4 w-4" />
                        Unpaid
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePayment(row)}
                      aria-label={`Mark ${row.seekerName} as ${row.paymentStatus === 'PAID' ? 'unpaid' : 'paid'}`}
                    >
                      {row.paymentStatus === 'PAID' ? 'Mark unpaid' : 'Mark paid'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
