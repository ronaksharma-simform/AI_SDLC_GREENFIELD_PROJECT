import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';

export const metadata = {
  title: 'My Rides | CoRide'
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  FULL: 'Full',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

/**
 * "My rides" page (REQ-4 / REQ-8).
 *
 * Server component that lists only the signed-in user's own created rides,
 * ordered by upcoming departure time. Like `/dashboard` it redirects to `/login`
 * when no session is present (defence in depth on top of the API's own checks).
 */
export default async function RidesPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const rides = await prisma.ride.findMany({
    where: { providerId: session.user.id },
    include: {
      vehicle: { select: { id: true, make: true, model: true, year: true, licensePlate: true } }
    },
    orderBy: { departureTime: 'asc' }
  });

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>My rides</h1>
      <p>
        <Link href="/rides/new">Offer a ride</Link> &middot;{' '}
        <Link href="/dashboard">Dashboard</Link>
      </p>

      {rides.length === 0 ? (
        <p>You haven&rsquo;t offered any rides yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rides.map((ride) => (
            <li
              key={ride.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: '0.75rem 1rem',
                marginBottom: '0.75rem'
              }}
            >
              <p style={{ margin: 0, fontWeight: 600 }}>
                {ride.source} &rarr; {ride.destination}
              </p>
              <p style={{ margin: '0.25rem 0', color: '#555' }}>
                {formatDateTime(ride.departureTime)} &middot;{' '}
                {ride.seatsAvailable} of {ride.seatsTotal} seats &middot;{' '}
                {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model}
              </p>
              <p style={{ margin: 0 }}>
                <span style={badgeStyle(ride.status)}>{STATUS_LABELS[ride.status] ?? ride.status}</span>{' '}
                <Link href={`/rides/${ride.id}`}>View / edit</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function badgeStyle(status: string): React.CSSProperties {
  const colors: Record<string, string> = {
    ACTIVE: '#1e7d34',
    FULL: '#8a6d1a',
    CANCELLED: '#b00020',
    COMPLETED: '#333'
  };
  return {
    display: 'inline-block',
    padding: '0.1rem 0.5rem',
    borderRadius: 999,
    fontSize: '0.8rem',
    color: '#fff',
    background: colors[status] ?? '#555',
    marginRight: '0.5rem'
  };
}
