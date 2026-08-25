import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquareText } from 'lucide-react';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/format-date';
import { conversationWhereParticipant } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RouteLine } from '@/components/route-line';

export const metadata = {
  title: 'Messages'
};

const RIDE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  FULL: 'Full',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed'
};

export default async function MessagesPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const conversations = await prisma.conversation.findMany({
    where: conversationWhereParticipant(session.user.id),
    include: {
      ride: {
        select: { id: true, sourceAddress: true, destinationAddress: true, status: true }
      },
      provider: { select: { id: true, name: true, email: true } },
      seeker: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
      _count: {
        select: {
          messages: {
            where: { senderId: { not: session.user.id }, readAt: null }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const items = conversations
    .map((conversation) => {
      const isProvider = conversation.providerId === session.user.id;
      const otherParticipant = isProvider ? conversation.seeker : conversation.provider;
      return {
        id: conversation.id,
        status: conversation.status,
        createdAt: conversation.createdAt,
        closedAt: conversation.closedAt,
        ride: conversation.ride,
        otherParticipant,
        lastMessage: conversation.messages[0] ?? null,
        unreadCount: conversation._count.messages
      };
    })
    .sort((a, b) => {
      const aTime = a.lastMessage
        ? new Date(a.lastMessage.sentAt).getTime()
        : new Date(a.createdAt).getTime();
      const bTime = b.lastMessage
        ? new Date(b.lastMessage.sentAt).getTime()
        : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

  const unreadTotal = items.reduce((sum, item) => sum + item.unreadCount, 0);

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="mt-1 text-muted-foreground">
            Conversations start automatically when a ride request is accepted.
            {unreadTotal > 0
              ? ` You have ${unreadTotal} unread message${unreadTotal === 1 ? '' : 's'}.`
              : ''}
          </p>
        </header>

        {items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <MessageSquareText className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">No conversations yet</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Once a ride request is accepted, you and the other rider can
                  message each other here.
                </p>
              </div>
              <Button asChild>
                <Link href="/rides/feed">Find a ride</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const closed = item.status === 'CLOSED';
              const unread = item.unreadCount > 0;
              return (
                <li key={item.id}>
                  <Link href={`/messages/${item.id}`} className="block">
                    <Card
                      className={cn(
                        'transition-colors hover:bg-accent/50',
                        closed && 'opacity-70'
                      )}
                    >
                      <CardContent className="flex items-start gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                'truncate font-medium',
                                unread && !closed && 'font-bold'
                              )}
                            >
                              {item.otherParticipant.name ?? item.otherParticipant.email}
                            </span>
                            {closed ? (
                              <Badge variant="secondary">
                                Ride{' '}
                                {RIDE_STATUS_LABELS[item.ride.status] ?? 'completed'}
                              </Badge>
                            ) : unread ? (
                              <Badge variant="default">New</Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                            <RouteLine size="sm" dashed className="w-10 shrink-0" />
                            <span className="truncate">
                              {item.ride.sourceAddress} <span>&rarr;</span>{' '}
                              {item.ride.destinationAddress}
                            </span>
                          </p>
                          <p
                            className={cn(
                              'mt-1 truncate text-sm',
                              unread && !closed ? 'text-foreground' : 'text-muted-foreground'
                            )}
                          >
                            {item.lastMessage
                              ? item.lastMessage.content
                              : 'No messages yet — say hello!'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {item.lastMessage
                              ? formatDateTime(item.lastMessage.sentAt)
                              : formatDateTime(item.createdAt)}
                          </span>
                          {unread && !closed ? (
                            <span
                              className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground"
                              aria-label={`${item.unreadCount} unread messages`}
                            >
                              {item.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
