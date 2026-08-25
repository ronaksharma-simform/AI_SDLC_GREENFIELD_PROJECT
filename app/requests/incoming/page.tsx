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
import { RouteLine } from '@/components/route-line';

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

  // Resolve the conversation id for each Accepted request so the "Message"
  // entry point can deep-link into the chat (Part A §6).
  const acceptedPairs = ridesWithRequests.flatMap((ride) =>
    ride.requests
      .filter((request) => request.status === 'ACCEPTED')
      .map((request) => ({
        rideId: ride.id,
        providerId: session.user.id,
        seekerId: request.seeker.id
      }))
  );
  const conversationIdByPair = new Map<string, string>();
  if (acceptedPairs.length > 0) {
    const conversations = await prisma.conversation.findMany({
      where: { OR: acceptedPairs },
      select: { id: true, rideId: true, providerId: true, seekerId: true }
    });
    for (const conversation of conversations) {
      conversationIdByPair.set(
        `${conversation.rideId}:${conversation.providerId}:${conversation.seekerId}`,
        conversation.id
      );
    }
  }

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
            {ridesWithRequests.map((ride) => {
              const pendingRequests = ride.requests.filter(
                (request) => request.status === 'PENDING'
              );
              const respondedRequests = ride.requests.filter(
                (request) => request.status !== 'PENDING'
              );

              return (
                <section key={ride.id} aria-label={`Requests for ${ride.sourceAddress} to ${ride.destinationAddress}`}>
                  <div className="rounded-xl border border-primary/20 bg-gradient-brand-soft p-3">
                    <RouteLine
                      source={ride.sourceAddress}
                      destination={ride.destinationAddress}
                      size="md"
                      dashed
                    />
                  </div>
                  <div className="mb-3 mt-1 text-sm text-muted-foreground">
                    Departs {formatDateTime(ride.departureTime)}
                  </div>

                  {/* Actionable requests — pending ones keep the respond buttons. */}
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
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
                          <RespondRequestButtons requestId={request.id} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Already-handled requests stay visible in a muted section
                      with their status badge but without action buttons
                      (Part A §7). */}
                  {respondedRequests.length > 0 ? (
                    <div className="mt-4">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Responded
                        </h3>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                      <div className="space-y-3">
                        {respondedRequests.map((request) => (
                          <Card key={request.id} className="opacity-75">
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
                              {request.status === 'ACCEPTED' ? (
                                (() => {
                                  const conversationId = conversationIdByPair.get(
                                    `${ride.id}:${session.user.id}:${request.seeker.id}`
                                  );
                                  return conversationId ? (
                                    <div className="mt-3">
                                      <Button asChild size="sm">
                                        <Link href={`/messages/${conversationId}`}>
                                          Message {request.seeker.name ?? request.seeker.email}
                                        </Link>
                                      </Button>
                                    </div>
                                  ) : null;
                                })()
                              ) : null}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
