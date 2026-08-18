'use client';

import { useState, type FormEvent } from 'react';

export default function SignupPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    organization: '',
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.status === 201) {
        setStatus('success');
        setMessage('Account created successfully. You can now sign in.');
        return;
      }

      const data = await res.json().catch(() => ({}));
      setStatus('error');
      setMessage(
        res.status === 409
          ? 'An account with this email already exists.'
          : data?.error ?? 'Something went wrong. Please try again.'
      );
    } catch {
      setStatus('error');
      setMessage('Unable to reach the server. Please try again.');
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '2rem' }}>
      <h1>Create your CoRide account</h1>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={form.name}
          onChange={update('name')}
        />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={update('email')}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update('password')}
        />

        <label htmlFor="organization">Organization</label>
        <input
          id="organization"
          name="organization"
          type="text"
          required
          value={form.organization}
          onChange={update('organization')}
        />

        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      {message && (
        <p role={status === 'error' ? 'alert' : 'status'}>{message}</p>
      )}
    </main>
  );
}
