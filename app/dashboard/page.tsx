import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CarFront,
  Mail,
  Search,
  Sparkles
} from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RouteLine } from '@/components/route-line';
import { CommuteScene } from '@/components/commute-scene';
import { RequestStatusBadge } from '@/components/request-status-badge';

export const metadata = {
  title: 'Dashboard'
};

export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  const { name, email, role } = session.user;

  // Upcoming rides the user is offering (as Provider).
  const providerRides = await prisma.ride.findMany({
    where: { providerId: session.user.id, status: { in: ['ACTIVE', 'FULL'] } },
    include: { vehicle: { select: { id: true, make: true, model: true, licensePlate: true } } },
    orderBy: { departureTime: 'asc' },
    take: 3
  });

  // Upcoming rides the user is joining (accepted or pending requests as Seeker).
  const seekerRequests = await prisma.rideRequest.findMany({
    where: { seekerId: session.user.id, status: { in: ['PENDING', 'ACCEPTED'] } },
    include: {
      ride: {
        include: { provider: { select: { id: true, name: true, email: true } } }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 3
  });

  const unreadNotifications = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false }
  });

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* ── Hero band — contained Three.js commute scene (Section 5.4) ── */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/20 shadow-lg shadow-primary/10">
          {/* Bounded, contained scene: sits behind the greeting and CTAs. */}
          <div className="absolute inset-0 z-0 bg-gradient-brand-soft" aria-hidden="true" />
          <CommuteScene />

          <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-lg">
              <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Dashboard
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
                Welcome back, {name ?? email ?? 'rider'}!
              </h1>
              <p className="mt-1 text-muted-foreground">
                Your CoRide commute at a glance — offer a seat or hop in one.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:shrink-0">
              <Button asChild size="lg">
                <Link href="/rides/new">
                  <CarFront />
                  Offer a Ride
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/rides/feed">
                  <Search />
                  Find a Ride
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Unread notifications summary ─────────────────────────────── */}
        <Card hover>
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">Notifications</h2>
                <p className="text-sm text-muted-foreground">
                  {unreadNotifications > 0
                    ? `You have ${unreadNotifications} unread notification${
                        unreadNotifications === 1 ? '' : 's'
                      }.`
                    : 'You’re all caught up.'}
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/requests">
                View activity
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* ── Upcoming rides you're providing ───────────────────────────── */}
        <section aria-labelledby="providing-heading">
          <div className="flex items-center justify-between">
            <h2 id="providing-heading" className="font-display text-xl font-semibold">
              Rides you&rsquo;re providing
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/rides">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </div>

          {providerRides.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <CalendarClock className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">No upcoming rides</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Share your commute and publish your first ride.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/rides/new">
                    <CarFront />
                    Offer a Ride
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {providerRides.map((ride) => (
                <Card key={ride.id} hover>
                  <CardContent className="p-5">
                    <RouteLine
                      source={ride.sourceAddress}
                      destination={ride.destinationAddress}
                      size="sm"
                      dashed
                    />
                    <p className="mt-3 font-mono text-xs text-muted-foreground">
                      {formatDateTime(ride.departureTime)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {ride.seatsAvailable} of {ride.seatsTotal} seats
                      </span>
                      <Badge variant="outline">
                        {ride.vehicle.make} {ride.vehicle.model}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Rides you're joining (as Seeker) ──────────────────────────── */}
        <section aria-labelledby="joining-heading">
          <div className="flex items-center justify-between">
            <h2 id="joining-heading" className="font-display text-xl font-semibold">
              Rides you&rsquo;re joining
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/requests">
                View all
                <ArrowRight />
              </Link>
            </Button>
          </div>

          {seekerRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                  <Search className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold">No rides joined yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Browse the feed and request a seat on a ride that fits.
                  </p>
                </div>
                <Button asChild>
                  <Link href="/rides/feed">
                    <Search />
                    Find a Ride
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {seekerRequests.map((request) => (
                <Card key={request.id} hover>
                  <CardContent className="p-5">
                    <RouteLine
                      source={request.ride.sourceAddress}
                      destination={request.ride.destinationAddress}
                      size="sm"
                      dashed
                    />
                    <p className="mt-3 font-mono text-xs text-muted-foreground">
                      {formatDateTime(request.ride.departureTime)}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-muted-foreground">
                        {request.ride.provider.name ?? request.ride.provider.email}
                      </span>
                      <RequestStatusBadge status={request.status} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Profile summary ───────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Profile
            </CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Email</dt>
                <dd className="mt-0.5 font-medium">{email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Role</dt>
                <dd className="mt-0.5 font-medium">{role ?? 'USER'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
