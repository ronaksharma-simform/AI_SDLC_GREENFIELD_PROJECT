import Link from 'next/link';
import { ArrowRight, CalendarClock, CarFront, Route, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    title: 'Offer rides',
    description:
      'Post a ride in seconds — choose your vehicle, set your route and departure, and publish the seats you want to share.',
    icon: CarFront
  },
  {
    title: 'Manage vehicles',
    description:
      'Register your vehicles once and reuse them across every ride, with seat capacity and type always at hand.',
    icon: Route
  },
  {
    title: 'Track every journey',
    description:
      'See seat availability, departure times, and ride status at a glance, and update or cancel your own rides anytime.',
    icon: CalendarClock
  }
];

export default function HomePage() {
  return (
    <main className="container flex flex-col items-center py-16 md:py-24">
      <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <CarFront className="h-3.5 w-3.5" />
          Carpooling made simple
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Ride sharing, reimagined.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Offer seats in your car, plan your route, and share the journey — all from one clean
          dashboard.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/signup">
              Get started
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </section>

      <section className="mt-20 grid w-full gap-6 md:grid-cols-3" aria-label="Features">
        {FEATURES.map((feature) => (
          <Card key={feature.title} className="transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-start gap-4 p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-16 flex max-w-2xl flex-col items-center gap-2 text-center">
        <Users className="h-8 w-8 text-primary" />
        <p className="text-sm text-muted-foreground">
          Ready to hit the road?{' '}
          <Link href="/rides/new" className="font-medium text-primary underline-offset-4 hover:underline">
            Offer your first ride
          </Link>
        </p>
      </section>
    </main>
  );
}
