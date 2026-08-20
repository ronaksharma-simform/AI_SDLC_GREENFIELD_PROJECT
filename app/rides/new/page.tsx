import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NewRideForm } from './new-ride-form';

export const metadata = {
  title: 'Offer a Ride | CoRide'
};

/**
 * "Offer a ride" page (REQ-1).
 *
 * Renders a form for creating a ride with one of the signed-in user's vehicles.
 * The page itself stays renderable without a session (showing a sign-in prompt),
 * mirroring `/vehicles/new`; creation is gated by `POST /api/rides`, which
 * returns 401 without a valid session.
 */
export default async function NewRidePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Offer a ride</h1>
        <p>
          Please <Link href="/login">sign in</Link> to offer a ride.
        </p>
      </main>
    );
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' }
  });

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Offer a ride</h1>

      {vehicles.length === 0 ? (
        <p>
          You need to <Link href="/vehicles/new">register a vehicle</Link> before you can offer a ride.
        </p>
      ) : (
        <NewRideForm
          vehicles={vehicles.map((vehicle) => ({
            id: vehicle.id,
            label: `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`,
            seatCapacity: vehicle.seatCapacity
          }))}
        />
      )}

      <p style={{ marginTop: '1rem' }}>
        <Link href="/rides">Back to my rides</Link>
      </p>
    </main>
  );
}
