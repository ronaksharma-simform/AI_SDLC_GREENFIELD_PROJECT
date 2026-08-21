import { notFound, redirect } from 'next/navigation';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { findConversationForUser } from '@/lib/conversations';
import { ConversationView } from '@/components/conversation-view';

export const metadata = {
  title: 'Conversation'
};

export default async function ConversationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const conversation = await findConversationForUser(id, session.user.id);
  if (!conversation) {
    notFound();
  }

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { sentAt: 'asc' }
  });

  const isProvider = conversation.providerId === session.user.id;
  const otherParticipant = isProvider ? conversation.seeker : conversation.provider;

  // Serialize Dates to ISO strings so the client component receives plain data.
  const initialMessages = messages.map((message) => ({
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    sentAt: message.sentAt.toISOString(),
    readAt: message.readAt ? message.readAt.toISOString() : null
  }));

  return (
    <ConversationView
      conversation={{ id: conversation.id, status: conversation.status }}
      currentUserId={session.user.id}
      otherParticipant={{ id: otherParticipant.id, name: otherParticipant.name, email: otherParticipant.email }}
      ride={{
        sourceAddress: conversation.ride.sourceAddress,
        destinationAddress: conversation.ride.destinationAddress,
        status: conversation.ride.status
      }}
      initialMessages={initialMessages}
    />
  );
}
