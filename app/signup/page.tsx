'use client';

import { useState } from 'react';

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
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Create your CoRide account</h1>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" style={{ color: '#1e7d34' }}>
          {success}
        </p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="name" style={labelStyle}>
            Name (optional)
          </label>
          <input id="name" name="name" type="text" autoComplete="name" style={inputStyle} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" style={inputStyle} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="password" style={labelStyle}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={inputStyle}
          />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '0.6rem 1.2rem', cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </main>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem' };

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  boxSizing: 'border-box'
};
