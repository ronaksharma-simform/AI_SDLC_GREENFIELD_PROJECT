import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { LogoutButton } from './logout-button';

export const metadata = {
  title: 'Dashboard | CoRide'
};

/**
 * Protected dashboard page.
 *
 * The root `middleware.ts` already gates `/dashboard` behind a valid access
 * token, but this server-side check is defence in depth: if a session is
 * somehow absent it redirects to `/login` rather than rendering a broken page.
 */
export default async function DashboardPage() {
  const user = await getSession();

  if (!user) {
    redirect('/login');
  }

  const { name, email, role } = user;

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Dashboard</h1>
      <p>
        Welcome, <strong>{name ?? email ?? 'rider'}</strong>!
      </p>
      <ul>
        <li>Email: {email ?? '—'}</li>
        <li>Role: {role ?? 'USER'}</li>
      </ul>
      <p>
        <Link href="/vehicles/new">Add a vehicle</Link>
      </p>
      <p>
        <Link href="/">Back to home</Link>
      </p>
      <p>
        <LogoutButton />
      </p>
    </main>
  );
}
