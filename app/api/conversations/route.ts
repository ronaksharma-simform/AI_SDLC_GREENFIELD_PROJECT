import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { conversationWhereParticipant } from '@/lib/conversations';

/**
 * GET /api/conversations
 *
 * Lists the current user's conversations (Part A §7 — API Surface). A
 * conversation is a private 1:1 chat between the ride's Provider and the
 * Seeker whose request was accepted, so only conversations where the caller is
 * a participant are ever returned (REQ-2).
 *
 * Each entry carries the other participant's profile, the ride route, the last
 * message (preview), and an `unreadCount` so the UI can visually distinguish
 * unread conversations (REQ-5).
 *
 * Responses:
 *   - 200 { ok: true, conversations: [...] }   on success
 *   - 401 { ok: false, error }                 no valid session
 *   - 500 { ok: false, error }                 unexpected failure
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
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
      // Most recently active first: conversations with a last message sort by
      // its sentAt, otherwise the newest conversation wins.
      .sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.sentAt).getTime() : new Date(a.createdAt).getTime();
        const bTime = b.lastMessage ? new Date(b.lastMessage.sentAt).getTime() : new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

    return NextResponse.json({ ok: true, conversations: items });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Conversation listing failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
