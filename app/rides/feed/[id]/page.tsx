import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarClock, MapPin, ShieldCheck, Users } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';
import { vehicleTypeLabel } from '@/lib/vehicle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { RequestJoinForm } from '@/components/request-join-form';

export const metadata = {
  title: 'Ride details'
};

export default async function RideFeedDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const ride = await prisma.ride.findUnique({
    where: { id },
    include: {
      vehicle: true,
      provider: { select: { id: true, name: true, email: true } }
    }
  });

  if (!ride) {
    notFound();
  }

  // Part A §5: if the Seeker already has an active request on this ride, the
  // request action is replaced with the current request status.
  const activeRequest = await prisma.rideRequest.findFirst({
    where: {
      rideId: id,
      seekerId: session.user.id,
      status: { in: ['PENDING', 'ACCEPTED'] }
    }
  });

  const isOwnRide = ride.providerId === session.user.id;
  const requestable = !isOwnRide && ride.status === 'ACTIVE' && ride.seatsAvailable > 0;

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Ride details</h1>
          <p className="mt-1 text-muted-foreground">
            <Link href="/rides/feed" className="text-primary underline-offset-4 hover:underline">
              &larr; Back to the feed
            </Link>
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {ride.sourceAddress}
                <span className="text-muted-foreground">&rarr;</span>
                {ride.destinationAddress}
              </span>
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              Departs {formatDateTime(ride.departureTime)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Provider</dt>
                <dd className="mt-0.5 font-medium">
                  {ride.provider.name ?? ride.provider.email}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Vehicle</dt>
                <dd className="mt-0.5 font-medium">
                  {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model} (
                  {vehicleTypeLabel(ride.vehicle.vehicleType)})
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  Seats available
                </dt>
                <dd className="mt-0.5 font-medium">
                  {ride.seatsAvailable} of {ride.seatsTotal}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Status
                </dt>
                <dd className="mt-0.5 font-medium">{ride.status}</dd>
              </div>
              {ride.notes ? (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Provider notes</dt>
                  <dd className="mt-0.5 font-medium">{ride.notes}</dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {activeRequest ? (
          <Card>
            <CardContent className="flex flex-col items-start gap-3 py-6">
              <div>
                <h2 className="font-semibold">Request sent</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You already have an active request on this ride.
                </p>
              </div>
              <RequestStatusBadge status={activeRequest.status} />
              <div className="flex gap-3">
                <Button asChild variant="outline" size="sm">
                  <Link href="/requests">View my requests</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : isOwnRide ? (
          <Alert>
            <AlertTitle>This is your own ride</AlertTitle>
            <AlertDescription>
              You offered this ride, so you can&rsquo;t request a seat on it.
              <Link
                href={`/rides/${ride.id}`}
                className="ml-1 text-primary underline-offset-4 hover:underline"
              >
                View or edit it
              </Link>{' '}
              instead.
            </AlertDescription>
          </Alert>
        ) : requestable ? (
          <RequestJoinForm rideId={ride.id} seatsAvailable={ride.seatsAvailable} />
        ) : (
          <Alert variant="warning">
            <AlertTitle>Not accepting requests</AlertTitle>
            <AlertDescription>
              This ride is no longer open for requests.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </main>
  );
}
