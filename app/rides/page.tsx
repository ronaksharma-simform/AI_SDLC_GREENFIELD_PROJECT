import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarClock, PlusCircle } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

export const metadata = {
  title: 'My Rides'
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  FULL: 'Full',
  IN_PROGRESS: 'In Progress',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

function statusBadgeVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'FULL':
      return 'warning';
    case 'IN_PROGRESS':
      return 'secondary';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'secondary';
  }
}

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
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My rides</h1>
            <p className="mt-1 text-muted-foreground">
              The rides you have offered, ordered by departure time.
            </p>
          </div>
          <Button asChild>
            <Link href="/rides/new">
              <PlusCircle />
              Offer a ride
            </Link>
          </Button>
        </header>

        {rides.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <CalendarClock className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">No rides yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You haven&rsquo;t offered any rides yet. Share your first one to get started.
                </p>
              </div>
              <Button asChild>
                <Link href="/rides/new">
                  <PlusCircle />
                  Offer a ride
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Route</TableHead>
                    <TableHead className="hidden sm:table-cell">Departure</TableHead>
                    <TableHead>Seats</TableHead>
                    <TableHead className="hidden lg:table-cell">Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rides.map((ride) => (
                    <TableRow key={ride.id}>
                      <TableCell>
                        <div className="font-medium">
                          {ride.sourceAddress} <span className="text-muted-foreground">&rarr;</span>{' '}
                          {ride.destinationAddress}
                        </div>
                        <div className="text-xs text-muted-foreground sm:hidden">
                          {formatDateTime(ride.departureTime)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatDateTime(ride.departureTime)}
                      </TableCell>
                      <TableCell>
                        {ride.seatsAvailable} of {ride.seatsTotal}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(ride.status)}>
                          {STATUS_LABELS[ride.status] ?? ride.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/rides/${ride.id}`}>View / edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
            Back to dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
