import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';
import { isRideLocked } from '@/lib/rides';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RideDetailForm } from './ride-detail-form';

export const metadata = {
  title: 'Ride Details'
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  FULL: 'Full',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

function statusBadgeVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'FULL':
      return 'warning';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'secondary';
  }
}

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
    <main className="container py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Ride details</h1>
          <p className="mt-1 text-muted-foreground">
            Review your ride and update the details below.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {ride.source} <span className="text-muted-foreground">&rarr;</span> {ride.destination}
              <Badge variant={statusBadgeVariant(ride.status)}>
                {STATUS_LABELS[ride.status] ?? ride.status}
              </Badge>
            </CardTitle>
            <CardDescription>Departure: {formatDateTime(ride.departureTime)}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Vehicle</dt>
                <dd className="mt-0.5 font-medium">
                  {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model} (
                  {ride.vehicle.licensePlate})
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Seats</dt>
                <dd className="mt-0.5 font-medium">
                  {ride.seatsAvailable} of {ride.seatsTotal} available
                </dd>
              </div>
              {ride.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Notes</dt>
                  <dd className="mt-0.5 font-medium">{ride.notes}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {locked ? (
          <Alert variant="warning">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Ride locked</AlertTitle>
            <AlertDescription>
              This ride is locked because a seat has already been accepted. Vehicle, seat count, and
              departure time can no longer be changed.
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardContent className="p-6">
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
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          <Link href="/rides" className="text-primary underline-offset-4 hover:underline">
            Back to my rides
          </Link>
        </p>
      </div>
    </main>
  );
}
