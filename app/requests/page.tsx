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
import { CancelRequestButton } from '@/components/cancel-request-button';
import { RouteLine } from '@/components/route-line';

export const metadata = {
  title: 'My requests'
};

export default async function MyRequestsPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const requests = await prisma.rideRequest.findMany({
    where: { seekerId: session.user.id },
    include: {
      ride: {
        include: {
          vehicle: true,
          provider: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Resolve the conversation id for each Accepted request so the "Message"
  // entry point can deep-link into the chat (Part A §6).
  const acceptedPairs = requests
    .filter((request) => request.status === 'ACCEPTED')
    .map((request) => ({
      rideId: request.rideId,
      providerId: request.ride.providerId,
      seekerId: session.user.id
    }));
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
          <h1 className="text-3xl font-bold tracking-tight">My requests</h1>
          <p className="mt-1 text-muted-foreground">
            Track the status of the ride requests you&rsquo;ve sent.
          </p>
        </header>

        <RequestSubNav active="mine" />

        {requests.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Inbox className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">No requests yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Find a ride that fits and request a seat — it will appear here.
                </p>
              </div>
              <Button asChild>
                <Link href="/rides/feed">Find a ride</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-5">
                  <div className="rounded-xl border border-primary/20 bg-gradient-brand-soft p-3">
                    <RouteLine
                      source={request.ride.sourceAddress}
                      destination={request.ride.destinationAddress}
                      size="sm"
                      dashed
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 text-sm text-muted-foreground">
                      {formatDateTime(request.ride.departureTime)} ·{' '}
                      {request.seatsRequested} seat(s) requested
                    </div>
                    <RequestStatusBadge status={request.status} />
                  </div>

                  {request.message ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      &ldquo;{request.message}&rdquo;
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/rides/feed/${request.rideId}`}>View ride</Link>
                    </Button>
                    {request.status === 'ACCEPTED' ? (
                      (() => {
                        const conversationId = conversationIdByPair.get(
                          `${request.rideId}:${request.ride.providerId}:${session.user.id}`
                        );
                        return conversationId ? (
                          <Button asChild size="sm">
                            <Link href={`/messages/${conversationId}`}>
                              Message {request.ride.provider.name ?? request.ride.provider.email}
                            </Link>
                          </Button>
                        ) : null;
                      })()
                    ) : null}
                    {request.status === 'PENDING' ? (
                      <CancelRequestButton requestId={request.id} />
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
