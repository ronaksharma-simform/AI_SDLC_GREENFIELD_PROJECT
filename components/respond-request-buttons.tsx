'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

type ResponseAction = 'accept' | 'reject';

/**
 * Provider-side Accept / Reject actions for a Pending incoming request.
 * Calls `PATCH /api/requests/{id}/accept|reject` then refreshes the
 * server-rendered list. Once responded to, the request is re-rendered without
 * these action buttons (its status badge remains).
 */
export function RespondRequestButtons({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [action, setAction] = useState<ResponseAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(next: ResponseAction) {
    setAction(next);
    setError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}/${next}`, { method: 'PATCH' });
      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }
      const body: { ok: boolean; error?: string } = await res.json();
      if (res.ok && body.ok) {
        router.refresh();
      } else {
        setError(body.error ?? `Could not ${next} the request.`);
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        size="sm"
        disabled={action !== null}
        onClick={() => respond('accept')}
      >
        {action === 'accept' ? 'Accepting…' : 'Accept'}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={action !== null}
        onClick={() => respond('reject')}
      >
        {action === 'reject' ? 'Rejecting…' : 'Reject'}
      </Button>
    </div>
  );
}
