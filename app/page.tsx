import Link from 'next/link';
import { ArrowRight, CalendarClock, CarFront, Route, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CommuteScene } from '@/components/commute-scene';

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

/** Dashed gradient route-line motif (signature "Commute Gradient" detail). */
function RouteLine() {
  return (
    <svg
      className="mx-auto h-10 w-44 text-primary"
      viewBox="0 0 176 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      <path
        d="M8 20 H 64 C 86 20 86 6 108 6 H 168"
        stroke="url(#route-grad)"
        strokeWidth="2"
        strokeLinecap="round"
        className="route-dash"
      />
      <circle cx="8" cy="20" r="4" fill="#6366f1" />
      <circle cx="168" cy="6" r="4" fill="#fb7185" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main>
      {/* ── Hero — signature Three.js commute scene ─────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Gradient backdrop (also shows through the transparent WebGL canvas). */}
        <div className="absolute inset-0 z-0 bg-gradient-brand-soft" aria-hidden="true" />
        {/* Soft fade into the page background below the hero. */}
        <div
          className="absolute inset-x-0 bottom-0 z-0 h-24 bg-gradient-to-t from-background to-transparent"
          aria-hidden="true"
        />
        <CommuteScene />

        <div className="container relative z-10 flex min-h-[560px] flex-col items-center justify-center py-20 text-center md:min-h-[640px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs font-medium text-primary animate-fade-up">
            <CarFront className="h-3.5 w-3.5" />
            Carpooling made simple
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight animate-fade-up [animation-delay:80ms] sm:text-5xl md:text-6xl lg:text-7xl">
            Ride sharing,{' '}
            <span className="text-gradient-brand-animated">reimagined.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground animate-fade-up [animation-delay:160ms]">
            Offer seats in your car, plan your route, and share the journey — all
            from one clean dashboard.
          </p>
          <div className="mt-9 flex flex-col gap-3 animate-fade-up [animation-delay:240ms] sm:flex-row">
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
        </div>
      </section>

      {/* ── Route-line motif divider ────────────────────────────────────── */}
      <section className="container py-10" aria-hidden="true">
        <RouteLine />
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="container pb-16" aria-label="Features">
        <div className="grid w-full gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} hover>
              <CardContent className="flex flex-col items-start gap-4 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25 transition-transform duration-300">
                  <feature.icon className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold">{feature.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Call to action ──────────────────────────────────────────────── */}
      <section className="container pb-20">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25 animate-float">
            <Users className="h-6 w-6" />
          </span>
          <p className="mt-3 text-sm text-muted-foreground">
            Ready to hit the road?{' '}
            <Link
              href="/rides/new"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Offer your first ride
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
