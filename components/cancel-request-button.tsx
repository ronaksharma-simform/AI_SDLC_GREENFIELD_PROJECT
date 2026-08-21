'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

/**
 * Seeker-side cancel action for a Pending ride request (My Requests view).
 * Calls `PATCH /api/requests/{id}/cancel` then refreshes the server-rendered
 * list so the updated status appears without a full reload.
 */
export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/cancel`, { method: 'PATCH' });
      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }
      const body: { ok: boolean; error?: string } = await res.json();
      if (res.ok && body.ok) {
        router.refresh();
      } else {
        setError(body.error ?? 'Could not cancel the request.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCancel}
        disabled={loading}
      >
        {loading ? 'Cancelling…' : 'Cancel request'}
      </Button>
    </div>
  );
}
