import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CalendarClock, CarFront, Mail, Search, Shield, Sparkles } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard'
};

const QUICK_ACTIONS = [
  {
    href: '/rides/feed',
    title: 'Find a ride',
    description: 'Browse available rides and request a seat.',
    icon: Search
  },
  {
    href: '/requests',
    title: 'Requests',
    description: 'Track the requests you sent and respond to incoming ones.',
    icon: Mail
  },
  {
    href: '/rides',
    title: 'My rides',
    description: 'View, edit, or cancel the rides you have offered.',
    icon: CalendarClock
  },
  {
    href: '/rides/new',
    title: 'Offer a ride',
    description: 'Publish a new ride with one of your vehicles.',
    icon: ArrowRight
  },
  {
    href: '/vehicles/new',
    title: 'Add a vehicle',
    description: 'Register a vehicle so you can offer rides with it.',
    icon: CarFront
  }
];

export default async function DashboardPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  const { name, email, role } = session.user;

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Gradient hero header */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 text-primary-foreground shadow-lg shadow-primary/25">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-black/10"
            aria-hidden="true"
          />
          <div className="relative">
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary-foreground/80">
              <Sparkles className="h-4 w-4" />
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Welcome, {name ?? email ?? 'rider'}!
            </h1>
            <p className="mt-1 text-primary-foreground/85">
              Your CoRide commute at a glance.
            </p>
          </div>
        </header>

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
                <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Role
                </dt>
                <dd className="mt-0.5 font-medium">{role ?? 'USER'}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="text-lg font-semibold">
            Quick actions
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <Card key={action.href} hover>
                <CardContent className="flex flex-col items-start gap-3 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-md shadow-primary/25">
                    <action.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{action.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-1">
                    <Link href={action.href}>
                      Open
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <p className="text-sm text-muted-foreground">
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
