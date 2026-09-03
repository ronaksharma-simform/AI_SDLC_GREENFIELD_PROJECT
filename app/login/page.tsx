'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { loginSchema } from '@/lib/validation';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Surface a generic error when NextAuth redirected here with `?error=...`
  // (e.g. from middleware or a protected-page redirect).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setMessage('Invalid email or password.');
    }
  }, []);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setMessage('');

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setStatus('error');
      setMessage('Enter a valid email and password.');
      return;
    }

    const { email, password } = parsed.data;
    const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl') ?? '/';

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      if (!result || result.error) {
        // Deliberately generic: never reveal whether the email address or the
        // password was the problem (both failures surface the same error).
        setStatus('error');
        setMessage('Invalid email or password.');
        return;
      }

      router.push(result.url ?? callbackUrl);
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('Unable to sign in right now. Please try again.');
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '2rem' }}>
      <h1>Sign in to CoRide</h1>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={update('password')}
        />

        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {message && <p role="alert">{message}</p>}

      <p>
        New to CoRide? <Link href="/signup">Create an account</Link>
      </p>
    </main>
  );
}
