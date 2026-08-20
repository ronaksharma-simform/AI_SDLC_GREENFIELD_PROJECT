import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';
import { isRideLocked } from '@/lib/rides';
import { RideDetailForm } from './ride-detail-form';

export const metadata = {
  title: 'Ride Details | CoRide'
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  FULL: 'Full',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

/**
 * Ride detail page (REQ-8).
 *
 * Shows one of the signed-in user's rides and lets them edit or cancel it. A
 * ride that does not exist — or belongs to someone else — renders a 404 so we
 * never confirm the existence of another user's ride.
 */
export default async function RideDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: { vehicle: true }
  });

  if (!ride || ride.providerId !== session.user.id) {
    notFound();
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' }
  });

  const locked = isRideLocked(ride);

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Ride details</h1>

      <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
        {ride.source} &rarr; {ride.destination}
      </p>
      <p style={{ margin: '0.25rem 0', color: '#555' }}>
        Departure: {formatDateTime(ride.departureTime)}
      </p>
      <p style={{ margin: '0.25rem 0', color: '#555' }}>
        Vehicle: {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model} (
        {ride.vehicle.licensePlate})
      </p>
      <p style={{ margin: '0.25rem 0', color: '#555' }}>
        Seats: {ride.seatsAvailable} of {ride.seatsTotal} available &middot; Status:{' '}
        {STATUS_LABELS[ride.status] ?? ride.status}
      </p>
      {ride.notes && (
        <p style={{ margin: '0.25rem 0', color: '#555' }}>Notes: {ride.notes}</p>
      )}

      {locked && (
        <p
          role="status"
          style={{ background: '#fff4d6', border: '1px solid #e6c15a', borderRadius: 6, padding: '0.5rem 0.75rem' }}
        >
          This ride is locked because a seat has already been accepted. Vehicle, seat
          count, and departure time can no longer be changed.
        </p>
      )}

      <RideDetailForm
        ride={{
          id: ride.id,
          source: ride.source,
          destination: ride.destination,
          departureTime: ride.departureTime.toISOString(),
          seatsTotal: ride.seatsTotal,
          seatsAvailable: ride.seatsAvailable,
          status: ride.status,
          notes: ride.notes,
          vehicleId: ride.vehicleId,
          vehicle: ride.vehicle
        }}
        vehicles={vehicles.map((vehicle) => ({
          id: vehicle.id,
          label: `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`,
          seatCapacity: vehicle.seatCapacity
        }))}
        locked={locked}
      />

      <p style={{ marginTop: '1rem' }}>
        <Link href="/rides">Back to my rides</Link>
      </p>
    </main>
  );
}
