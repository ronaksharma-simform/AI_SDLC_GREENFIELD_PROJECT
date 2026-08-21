import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { findConversationForUser } from '@/lib/conversations';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/conversations/{id}/read
 *
 * Marks every incoming message in the conversation (messages the other
 * participant sent that the caller hasn't read yet) as read. Only a participant
 * may do this (REQ-2). Idempotent: already-read messages are untouched.
 *
 * Responses:
 *   - 200 { ok: true, updated }   on success (`updated` = number of messages marked)
 *   - 400 { ok: false, error }    malformed conversation id
 *   - 401 { ok: false, error }    no valid session
 *   - 404 { ok: false, error }    conversation not found / not a participant
 *   - 500 { ok: false, error }    unexpected failure
 */
export async function PATCH(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid conversation ID.' }, { status: 400 });
  }

  try {
    const conversation = await findConversationForUser(id, session.user.id);
    if (!conversation) {
      return Response.json({ ok: false, error: 'Conversation not found.' }, { status: 404 });
    }

    const result = await prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: { not: session.user.id },
        readAt: null
      },
      data: { readAt: new Date() }
    });

    return NextResponse.json({ ok: true, updated: result.count });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Conversation read-marking failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
