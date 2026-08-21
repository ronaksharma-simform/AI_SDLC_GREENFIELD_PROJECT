import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';
import { messageCreateSchema } from '@/lib/validation';
import { findConversationForUser, isParticipant, sanitizeMessageContent } from '@/lib/conversations';
import { notifyUser } from '@/lib/notifications';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/conversations/{id}/messages
 *
 * Fetches the message history for a conversation (Part A §7). Only a participant
 * may read it (REQ-2). Messages are returned in chronological order.
 *
 * Responses:
 *   - 200 { ok: true, conversation, messages }   on success
 *   - 400 { ok: false, error }                   malformed conversation id
 *   - 401 { ok: false, error }                   no valid session
 *   - 404 { ok: false, error }                   conversation not found / not a participant
 *   - 500 { ok: false, error }                   unexpected failure
 */
export async function GET(_request: Request, { params }: RouteContext) {
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

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { sentAt: 'asc' }
    });

    return NextResponse.json({
      ok: true,
      conversation: { id: conversation.id, status: conversation.status },
      messages
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Conversation message fetch failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/conversations/{id}/messages
 *
 * Sends a new text message in an Active conversation (REQ-3). The sender must be
 * one of the two participants and the conversation must still be Active — a
 * Closed conversation no longer accepts new messages (REQ-6 / REQ-7). Content is
 * sanitized before storage (Part A §7 — Security).
 *
 * Accepts a JSON body: { "content": string }
 *
 * Responses:
 *   - 201 { ok: true, message }     on success
 *   - 400 { ok: false, error, details? }  malformed JSON or failed validation
 *   - 401 { ok: false, error }      no valid session
 *   - 404 { ok: false, error }      conversation not found / not a participant
 *   - 409 { ok: false, error }      conversation is Closed
 *   - 500 { ok: false, error }      unexpected failure
 */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid conversation ID.' }, { status: 400 });
  }

  const raw = await request.text();
  if (!raw.trim()) {
    return Response.json(
      { ok: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { ok: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const parsed = messageCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation || !isParticipant(conversation, session.user.id)) {
      return Response.json({ ok: false, error: 'Conversation not found.' }, { status: 404 });
    }

    if (conversation.status !== 'ACTIVE') {
      return Response.json(
        { ok: false, error: 'This conversation is closed and no longer accepts messages.' },
        { status: 409 }
      );
    }

    const content = sanitizeMessageContent(parsed.data.content);

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: session.user.id,
        content
      }
    });

    const otherUserId =
      conversation.providerId === session.user.id
        ? conversation.seekerId
        : conversation.providerId;

    // REQ-5: the recipient is notified of the new message. Delivery (push /
    // email / in-app) is owned by the separate Notifications module; `senderName`
    // lets it build the "New message from …" copy.
    await notifyUser(otherUserId, 'NewMessage', {
      rideId: conversation.rideId,
      senderName: session.user.name ?? session.user.email ?? undefined
    });

    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Conversation message send failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
