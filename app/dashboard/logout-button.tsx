'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Logout button.
 *
 * POSTs to `/api/auth/logout` (which revokes the refresh token server-side and
 * clears the session cookies) then returns the user to the login page.
 */
export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      // Even if the network call fails, take the user back to the login page.
      router.push('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      style={{ padding: '0.4rem 1rem', cursor: loading ? 'wait' : 'pointer' }}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
