import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CarFront, PlusCircle, Users } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { vehicleTypeLabel } from '@/lib/vehicle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = {
  title: 'My Vehicles'
};

/**
 * Vehicle List (Section 5.5).
 *
 * A calm, read-only grid of the user's registered vehicles. No route-line motif
 * here — vehicles aren't routes, so the signature element is intentionally
 * absent to keep the page visually quieter than ride-related pages.
 */
export default async function VehiclesPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' }
  });

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">My vehicles</h1>
            <p className="mt-1 text-muted-foreground">
              Vehicles you can offer rides with, by seat capacity and type.
            </p>
          </div>
          <Button asChild>
            <Link href="/vehicles/new">
              <PlusCircle />
              Add Vehicle
            </Link>
          </Button>
        </header>

        {vehicles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand-soft text-primary">
                <CarFront className="h-7 w-7" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">No vehicles yet</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                  Add your first vehicle so you can offer rides with it. You only
                  need to register it once.
                </p>
              </div>
              <Button asChild>
                <Link href="/vehicles/new">
                  <PlusCircle />
                  Add your first vehicle
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => (
              <Card key={vehicle.id} hover>
                <CardHeader className="p-5 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      {vehicle.make} {vehicle.model}
                    </CardTitle>
                    <Badge variant="secondary">{vehicleTypeLabel(vehicle.vehicleType)}</Badge>
                  </div>
                  <CardDescription>{vehicle.year}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-5 pt-3">
                  {/* Licence plate in the mono data type (Section 3). */}
                  <div className="flex items-center justify-between rounded-lg border border-cloud bg-mist px-3 py-2">
                    <span className="text-xs text-muted-foreground">Plate</span>
                    <span className="font-mono text-sm font-semibold tracking-widest">
                      {vehicle.licensePlate}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {vehicle.seatCapacity} seat{vehicle.seatCapacity === 1 ? '' : 's'}
                    {vehicle.color ? (
                      <span className="text-muted-foreground">· {vehicle.color}</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
