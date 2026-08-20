import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '0 auto' }}>
      <h1>CoRide</h1>
      <p>Ride sharing, reimagined.</p>
      <p>
        <Link href="/signup">Create an account</Link>
      </p>
      <p>
        <Link href="/rides/new">Offer a ride</Link> &middot; <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
