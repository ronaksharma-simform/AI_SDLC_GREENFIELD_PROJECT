import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '2rem' }}>
      <h1>CoRide</h1>
      <p>Share commutes with colleagues in your organization.</p>
      <Link href="/signup">Create an account</Link>
    </main>
  );
}
