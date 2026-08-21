'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/field';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RequestJoinFormProps {
  rideId: string;
  seatsAvailable: number;
}

interface JoinResponse {
  ok: boolean;
  error?: string;
  details?: Record<string, string[]>;
}

/**
 * "Request to Join" form shown on the Seeker's Ride Detail view (Part A §5).
 * Defaults to 1 seat, optional message, and transitions the request into the
 * Seeker's "My Requests" list as Pending on success.
 */
export function RequestJoinForm({ rideId, seatsAvailable }: RequestJoinFormProps) {
  const router = useRouter();
  const [seats, setSeats] = useState('1');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/rides/${rideId}/requests`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          seatsRequested: Number(seats),
          message: message.trim() || undefined
        })
      });

      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const body: JoinResponse = await res.json();
      if (res.ok && body.ok) {
        setSubmitted(true);
        // Re-render the server detail page so it now shows the active-request
        // status in place of this form.
        router.refresh();
      } else if (res.status === 400 && body.details) {
        setFieldErrors(body.details);
        setError(body.error ?? 'Please fix the highlighted fields.');
      } else {
        setError(body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Request sent!</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The provider has been notified. Track its status in My requests.
            </p>
          </div>
          <Button asChild>
            <Link href="/requests">View my requests</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request to join</CardTitle>
        <CardDescription>{seatsAvailable} seat(s) available on this ride.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <Field
            label="Seats needed"
            htmlFor="seats"
            required
            errors={fieldErrors?.seatsRequested}
          >
            <Input
              id="seats"
              name="seats"
              type="number"
              min={1}
              max={seatsAvailable}
              value={seats}
              onChange={(event) => setSeats(event.target.value)}
              aria-invalid={fieldErrors?.seatsRequested ? true : undefined}
            />
          </Field>

          <Field
            label="Message to provider"
            htmlFor="message"
            hint="Optional — e.g. pickup flexibility or luggage."
            errors={fieldErrors?.message}
          >
            <Textarea
              id="message"
              name="message"
              rows={2}
              maxLength={280}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-invalid={fieldErrors?.message ? true : undefined}
            />
          </Field>

          <Button type="submit" disabled={loading || seatsAvailable < 1} size="lg">
            {loading ? 'Sending…' : 'Request to join'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
