import Link from 'next/link';
import { ArrowRight, CarFront, Search, ShieldCheck, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RouteLine } from '@/components/route-line';
import { CommuteScene } from '@/components/commute-scene';

/**
 * How CoRide works — a simple offer / find / ride explanation. The route-line
 * motif (rather than numbered circles) separates the steps, echoing the
 * signature "Commute Gradient" identity (Section 5.1).
 */
const STEPS = [
  {
    title: 'Offer',
    description:
      'Register your vehicle and post a ride — choose your route, departure time, and the seats you want to share.',
    icon: CarFront
  },
  {
    title: 'Find',
    description:
      'Browse rides from people already verified in your trusted network and request the seat that fits your commute.',
    icon: Search
  },
  {
    title: 'Ride',
    description:
      'Get accepted, message the provider, and hit the road together — all coordinated in one place.',
    icon: Users
  }
];

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
            <ShieldCheck className="h-3.5 w-3.5" />
            Ride with people you trust
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight animate-fade-up [animation-delay:80ms] font-display sm:text-5xl md:text-6xl lg:text-7xl">
            Share your commute with{' '}
            <span className="text-gradient-brand-animated">people you trust.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground animate-fade-up [animation-delay:160ms]">
            CoRide connects you with riders and drivers inside your organisation — so every shared
            journey starts with a known, verified face.
          </p>
          <div className="mt-9 flex flex-col gap-3 animate-fade-up [animation-delay:240ms] sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                Get Started
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Log In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Route-line motif divider ────────────────────────────────────── */}
      <section className="container py-10" aria-hidden="true">
        <RouteLine size="md" dashed className="mx-auto max-w-sm" />
      </section>

      {/* ── How CoRide works: offer / find / ride ───────────────────────── */}
      <section className="container pb-20" aria-label="How CoRide works">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">How CoRide works</h2>
          <p className="mt-2 text-muted-foreground">
            Three simple steps from posting a ride to sharing the journey.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-3xl">
          {STEPS.map((step, index) => (
            <div key={step.title}>
              <Card hover>
                <CardContent className="flex flex-col items-start gap-4 p-6 text-center sm:flex-row sm:text-left">
                  <span className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25 transition-transform duration-300">
                    <step.icon className="h-6 w-6" />
                  </span>
                  <div className="mx-auto sm:mx-0">
                    <h3 className="font-display text-lg font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* The route line joins the steps — a literal little journey. */}
              {index < STEPS.length - 1 ? (
                <div className="flex justify-center py-6" aria-hidden="true">
                  <RouteLine size="md" dashed className="max-w-[240px]" />
                </div>
              ) : null}
            </div>
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
              href="/signup"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Join CoRide and share your first ride
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
