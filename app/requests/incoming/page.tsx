import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Inbox } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RequestSubNav } from '@/components/request-sub-nav';
import { RequestStatusBadge } from '@/components/request-status-badge';
import { RespondRequestButtons } from '@/components/respond-request-buttons';

export const metadata = {
  title: 'Incoming requests'
};

export default async function IncomingRequestsPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  // Requests received across all of the Provider's rides, grouped by ride.
  const rides = await prisma.ride.findMany({
    where: { providerId: session.user.id },
    include: {
      requests: {
        include: { seeker: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { departureTime: 'asc' }
  });

  const ridesWithRequests = rides.filter((ride) => ride.requests.length > 0);
  const hasPending = ridesWithRequests.some((ride) =>
    ride.requests.some((request) => request.status === 'PENDING')
  );

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Incoming requests</h1>
          <p className="mt-1 text-muted-foreground">
            Review and respond to requests for seats on your rides.
          </p>
        </header>

        <RequestSubNav active="incoming" />

        {ridesWithRequests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">
                  {hasPending ? 'All requests handled' : 'No incoming requests'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hasPending
                    ? 'There are no pending requests waiting for your response.'
                    : 'When someone requests a seat on one of your rides, it will show up here.'}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/rides">View my rides</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {ridesWithRequests.map((ride) => (
              <section key={ride.id} aria-label={`Requests for ${ride.sourceAddress} to ${ride.destinationAddress}`}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">
                    {ride.sourceAddress}{' '}
                    <span className="text-muted-foreground">&rarr;</span>{' '}
                    {ride.destinationAddress}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    Departs {formatDateTime(ride.departureTime)}
                  </span>
                </div>

                <div className="space-y-3">
                  {ride.requests.map((request) => (
                    <Card key={request.id}>
                      <CardContent className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">
                              {request.seeker.name ?? request.seeker.email}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {request.seatsRequested} seat(s) requested
                              {request.message ? (
                                <span> &middot; &ldquo;{request.message}&rdquo;</span>
                              ) : null}
                            </div>
                          </div>
                          <RequestStatusBadge status={request.status} />
                        </div>

                        {/* Only pending requests are actionable. Responded ones
                            stay visible with their status badge but lose the
                            action buttons (Part A §7). */}
                        {request.status === 'PENDING' ? (
                          <RespondRequestButtons requestId={request.id} />
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
