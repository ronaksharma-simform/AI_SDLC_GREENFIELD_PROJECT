import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Shared helpers for the Ride Chat (post-acceptance messaging) module.
 *
 * A Conversation is always a private 1:1 chat between a ride's Provider and a
 * Seeker whose request was accepted (Part A §3.3). These helpers centralise the
 * two invariants the rest of the module relies on:
 *
 *   - participant-only access: every read/write checks that the requesting user
 *     is `conversation.providerId` or `conversation.seekerId` (Part A §7);
 *   - the conversation lifecycle: created only on request acceptance (REQ-1,
 *     REQ-8) and closed when the ride is Completed or Cancelled (REQ-6).
 */

/** Max message length, matching the `messages.content` text column guardrail. */
export const MESSAGE_CONTENT_MAX = 2000;

/**
 * A minimal conversation shape carrying only the participant ids and status.
 * Used by the participant/status guards so route handlers can accept the lean
 * objects they fetch for access control.
 */
export interface ConversationGuardShape {
  id: string;
  providerId: string;
  seekerId: string;
  status: 'ACTIVE' | 'CLOSED';
}

/** True when `userId` is one of the conversation's two participants (REQ-2). */
export function isParticipant(conversation: Pick<ConversationGuardShape, 'providerId' | 'seekerId'>, userId: string): boolean {
  return conversation.providerId === userId || conversation.seekerId === userId;
}

/** The Prisma `where` fragment that selects only the caller's conversations. */
export function conversationWhereParticipant(userId: string): Prisma.ConversationWhereInput {
  return { OR: [{ providerId: userId }, { seekerId: userId }] };
}

/**
 * Loads one conversation and verifies the caller is a participant.
 *
 * Returns the conversation (with its ride and both participant users) when the
 * caller is allowed to see it, otherwise `null`. A missing conversation and a
 * conversation the caller has no access to both resolve to `null` so route
 * handlers can return a single 404 (Section 10 — Access Control).
 */
export async function findConversationForUser(id: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      ride: {
        select: { id: true, sourceAddress: true, destinationAddress: true, status: true }
      },
      provider: { select: { id: true, name: true, email: true } },
      seeker: { select: { id: true, name: true, email: true } }
    }
  });

  if (!conversation || !isParticipant(conversation, userId)) {
    return null;
  }

  return conversation;
}

/**
 * Closes every conversation attached to a ride (REQ-6).
 *
 * Closing is a status flag, never a deletion — message history is retained for
 * dispute resolution or reference. When the ride is marked Completed or
 * Cancelled this is called so the affected conversations stop accepting new
 * messages. Accepts an optional transaction client so it can participate in a
 * larger atomic update.
 */
export async function closeConversationsForRide(
  rideId: string,
  client: Pick<Prisma.TransactionClient, 'conversation'> = prisma
): Promise<number> {
  const result = await client.conversation.updateMany({
    where: { rideId, status: 'ACTIVE' },
    data: { status: 'CLOSED', closedAt: new Date() }
  });
  return result.count;
}

/**
 * Sanitizes a message body before it is stored (Part A §7 — Security).
 *
 * Content is trimmed, capped at `MESSAGE_CONTENT_MAX`, HTML tags are stripped
 * (so a pasted snippet can never inject markup), and CR/LF are normalised.
 * Combined with React's automatic escaping at render time this prevents script
 * injection in the chat UI. Newlines are preserved for readability.
 */
export function sanitizeMessageContent(input: string): string {
  const noTags = input.replace(/<[^>]*>/g, '');
  const normalized = noTags.replace(/\r\n?/g, '\n');
  const singleLines = normalized.replace(/[ \t]+\n/g, '\n').trim();
  return singleLines.slice(0, MESSAGE_CONTENT_MAX);
}
