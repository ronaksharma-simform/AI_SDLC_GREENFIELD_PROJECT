import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SignOutButton from '@/components/sign-out-button';

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '2rem' }}>
      <h1>CoRide</h1>
      {session?.user ? (
        <>
          <p>
            Signed in as <strong>{session.user.email}</strong> (
            {session.user.role.toLowerCase()})
          </p>
          <SignOutButton />
        </>
      ) : (
        <>
          <p>Share commutes with colleagues in your organization.</p>
          <Link href="/login">Sign in</Link>
          {' · '}
          <Link href="/signup">Create an account</Link>
        </>
      )}
    </main>
  );
}
