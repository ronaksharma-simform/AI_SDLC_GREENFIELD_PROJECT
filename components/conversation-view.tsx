'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Send, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  sentAt: string;
  readAt: string | null;
}

interface ConversationViewProps {
  conversation: { id: string; status: 'ACTIVE' | 'CLOSED' };
  currentUserId: string;
  otherParticipant: { id: string; name: string | null; email: string };
  ride: { sourceAddress: string; destinationAddress: string; status: string };
  initialMessages: ConversationMessage[];
}

/** Poll interval (ms) for near-real-time delivery (Part A §7 — fallback). */
const POLL_INTERVAL_MS = 4000;

function formatTimeCluster(value: string): string {
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * The chat thread for one conversation (Part A §6 — Conversation view).
 *
 * Renders message bubbles (right-aligned for the current user, left-aligned for
 * the other participant — REQ-4), auto-scrolls to the latest message, and
 * delivers new messages by short-interval polling while the view is open.
 *
 * The input is disabled with an explanatory note once the conversation is Closed
 * (REQ-6 / REQ-7); history remains fully visible.
 */
export function ConversationView({
  conversation,
  currentUserId,
  otherParticipant,
  ride,
  initialMessages
}: ConversationViewProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(conversation.status === 'CLOSED');

  const bottomRef = useRef<HTMLDivElement>(null);
  const markReadInFlight = useRef(false);

  // Auto-scroll to the latest message on open and on new message arrival.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Poll for new messages while the conversation is open, and mark incoming
  // messages as read. The poll doubles as the read-receipt trigger.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/conversations/${conversation.id}/messages`);
        if (!res.ok) return;
        const body: { ok: boolean; conversation: { status: 'ACTIVE' | 'CLOSED' }; messages: ConversationMessage[] } =
          await res.json();
        if (!body.ok || cancelled) return;
        setClosed(body.conversation.status === 'CLOSED');
        setMessages((current) => {
          const hasNewIncoming = body.messages.some(
            (message) =>
              message.senderId !== currentUserId &&
              current.every((existing) => existing.id !== message.id)
          );
          if (hasNewIncoming && !markReadInFlight.current) {
            markReadInFlight.current = true;
            void fetch(`/api/conversations/${conversation.id}/read`, { method: 'PATCH' })
              .catch(() => {})
              .finally(() => {
                markReadInFlight.current = false;
              });
          }
          return body.messages;
        });
      } catch {
        // Keep polling silently — transient network failures self-heal.
      }
    }

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [conversation.id, currentUserId]);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || closed || sending) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content })
      });
      const body: { ok: boolean; error?: string; message?: ConversationMessage } = await res.json();
      if (res.ok && body.ok && body.message) {
        setDraft('');
        setMessages((current) => [...current, body.message!]);
      } else if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
      } else if (res.status === 409) {
        setClosed(true);
        setError(body.error ?? 'This conversation is closed.');
      } else {
        setError(body.error ?? 'Could not send the message.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="container py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to messages">
            <Link href="/messages">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">
              {otherParticipant.name ?? otherParticipant.email}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              {ride.sourceAddress} <span>&rarr;</span> {ride.destinationAddress}
            </p>
          </div>
        </div>

        <div className="flex h-[28rem] flex-col overflow-hidden rounded-md border bg-background">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                No messages yet — say hello!
              </div>
            ) : (
              messages.map((message) => {
                const own = message.senderId === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={cn('flex flex-col', own ? 'items-end' : 'items-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm',
                        own
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-secondary text-secondary-foreground'
                      )}
                    >
                      {message.content}
                    </div>
                    <span
                      className={cn(
                        'mt-0.5 text-[11px] text-muted-foreground',
                        own ? 'text-right' : 'text-left'
                      )}
                    >
                      {formatTimeCluster(message.sentAt)}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {closed ? (
            <Alert variant="warning" className="m-3">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>
                This conversation is closed because the ride was{' '}
                {ride.status === 'CANCELLED' ? 'cancelled' : 'completed'}. Message
                history is preserved, but no new messages can be sent.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <p role="alert" className="px-4 text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <form onSubmit={handleSend} className="flex items-end gap-2 border-t p-3">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend(event);
                }
              }}
              placeholder={closed ? 'Conversation closed' : 'Type a message…'}
              disabled={closed || sending}
              rows={1}
              maxLength={2000}
              aria-label="Message"
              className="max-h-32 min-h-[2.5rem] resize-none"
            />
            <Button
              type="submit"
              size="icon"
              disabled={closed || sending || draft.trim().length === 0}
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/messages" className="text-primary underline-offset-4 hover:underline">
            Back to messages
          </Link>
        </p>
      </div>
    </main>
  );
}
