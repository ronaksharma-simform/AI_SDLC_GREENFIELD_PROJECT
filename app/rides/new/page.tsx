import Link from 'next/link';
import { CarFront, LogIn } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NewRideForm } from './new-ride-form';

export const metadata = {
  title: 'Offer a Ride'
};

export default async function NewRidePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    return (
      <main className="container flex min-h-[70vh] items-center justify-center py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25">
              <LogIn className="h-5 w-5" />
            </span>
            <CardTitle className="text-2xl">Offer a ride</CardTitle>
            <CardDescription>Please sign in to offer a ride.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/login">
                <LogIn />
                Sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'asc' }
  });

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Offer a ride</h1>
          <p className="mt-1 text-muted-foreground">
            Share your route and available seats with other CoRide members.
          </p>
        </header>

        {vehicles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <CarFront className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">You need a vehicle first</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Register a vehicle before you can offer a ride with it.
                </p>
              </div>
              <Button asChild>
                <Link href="/vehicles/new">Add a vehicle</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <NewRideForm
                vehicles={vehicles.map((vehicle) => ({
                  id: vehicle.id,
                  label: `${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})`,
                  seatCapacity: vehicle.seatCapacity
                }))}
              />
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground">
          <Link href="/rides" className="text-primary underline-offset-4 hover:underline">
            Back to my rides
          </Link>
        </p>
      </div>
    </main>
  );
}
