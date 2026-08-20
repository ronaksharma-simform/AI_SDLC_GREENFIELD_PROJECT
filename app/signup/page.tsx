'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CarFront, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RegisterResponse {
  ok: boolean;
  user?: { id: string; email: string; name: string | null; role: string; createdAt: string };
  error?: string;
  message?: string;
}

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') payload[key] = value;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body: RegisterResponse = await res.json();
      if (res.ok && body.ok) {
        setSuccess('Your account was created. You can now sign in.');
        form.reset();
      } else {
        setError(body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CarFront className="h-5 w-5" />
          </span>
          <CardTitle className="text-2xl">Create your CoRide account</CardTitle>
          <CardDescription>Join CoRide to offer rides and manage your vehicles.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {success ? (
            <Alert variant="success" role="status" className="mb-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Field label="Name" htmlFor="name" hint="Optional — this is how other riders see you.">
              <Input id="name" name="name" type="text" autoComplete="name" />
            </Field>
            <Field label="Email" htmlFor="email" required>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              required
              hint="At least 8 characters."
            >
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </Field>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? 'Creating account…' : 'Sign up'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
