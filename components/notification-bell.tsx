'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Inbox,
  MessageSquare,
  XCircle
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format-date';
import { Button } from '@/components/ui/button';

export type NotificationTypeValue =
  | 'RideRequestReceived'
  | 'RideRequestAccepted'
  | 'RideRequestRejected'
  | 'TripReminder'
  | 'NewMessage';

export interface NotificationItem {
  id: string;
  type: NotificationTypeValue;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  relatedRideId: string | null;
  relatedRequestId: string | null;
  relatedRide?: {
    id: string;
    sourceAddress: string;
    destinationAddress: string;
    departureTime: string;
    status: string;
  } | null;
}

interface NotificationTypeMeta {
  icon: typeof BellRing;
  iconClass: string;
  dotClass: string;
}

/** Icon + colour cue per notification type (Section 6). */
const TYPE_META: Record<NotificationTypeValue, NotificationTypeMeta> = {
  RideRequestReceived: { icon: Inbox, iconClass: 'text-blue-600', dotClass: 'bg-blue-500' },
  RideRequestAccepted: { icon: CheckCircle2, iconClass: 'text-emerald-600', dotClass: 'bg-emerald-500' },
  RideRequestRejected: { icon: XCircle, iconClass: 'text-red-600', dotClass: 'bg-red-500' },
  TripReminder: { icon: BellRing, iconClass: 'text-amber-600', dotClass: 'bg-amber-500' },
  NewMessage: { icon: MessageSquare, iconClass: 'text-indigo-600', dotClass: 'bg-indigo-500' }
};

/** Poll intervals (ms) for near-real-time delivery (Section 7 — fallback). */
const LIST_POLL_MS = 8000;
const BADGE_POLL_MS = 10000;
const TOAST_DURATION_MS = 5000;

/** Deep-links a notification to the relevant ride/request view (Section 6). */
export function notificationHref(item: NotificationItem): string {
  switch (item.type) {
    case 'RideRequestReceived':
      return '/requests/incoming';
    case 'RideRequestAccepted':
    case 'RideRequestRejected':
      return '/requests';
    case 'NewMessage':
      return '/messages';
    case 'TripReminder':
      return item.relatedRideId ? `/rides/feed/${item.relatedRideId}` : '/rides/feed';
  }
}

/**
 * Persistent notification bell (Section 4 / Section 5).
 *
 * Shown on every authenticated page via the site header. Fetches the unread
 * count for the badge, lists recent notifications in a dropdown, and — while
 * the app is open — delivers new notifications in-session via short-interval
 * polling (Section 7), surfacing a transient toast for genuinely new arrivals.
 */
export function NotificationBell() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<NotificationItem | null>(null);

  const openRef = useRef(false);
  const lastTopIdRef = useRef<string | null>(null);
  const suppressToastRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Poll the notification list so the dropdown and badge stay fresh, and detect
  // a genuinely new (unread) top notification to show a toast (Section 7).
  useEffect(() => {
    let cancelled = false;

    async function pollList() {
      try {
        const res = await fetch('/api/notifications');
        if (!res.ok) return;
        const body: { ok: boolean; notifications: NotificationItem[] } = await res.json();
        if (!body.ok || cancelled) return;

        setNotifications(body.notifications);

        const top = body.notifications[0];
        if (top && !top.isRead) {
          const isNewTop = lastTopIdRef.current !== null && lastTopIdRef.current !== top.id;
          lastTopIdRef.current = top.id;
          if (isNewTop && !suppressToastRef.current && !openRef.current) {
            setToast(top);
          }
        }
        suppressToastRef.current = false;
      } catch {
        // Keep polling silently — transient network failures self-heal.
      }
    }

    void pollList();
    const interval = setInterval(pollList, LIST_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Poll the exact unread count for the badge (kept accurate even beyond the
  // 50-item list cap).
  useEffect(() => {
    let cancelled = false;

    async function pollBadge() {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (!res.ok) return;
        const body: { ok: boolean; count: number } = await res.json();
        if (body.ok && !cancelled) setUnreadCount(body.count);
      } catch {
        // Ignore transient failures.
      }
    }

    void pollBadge();
    const interval = setInterval(pollBadge, BADGE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Auto-dismiss the toast.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close the dropdown on Escape.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function markRead(id: string) {
    suppressToastRef.current = true;
    setNotifications((items) =>
      items.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    );
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      // Optimistic update stands; the next poll reconciles the badge.
    }
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function markAllRead() {
    suppressToastRef.current = true;
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      const res = await fetch('/api/notifications', { method: 'PATCH' });
      if (res.ok) {
        const body: { ok: boolean; count: number } = await res.json();
        if (body.ok) setUnreadCount(0);
      }
    } catch {
      // Optimistic update stands.
    }
  }

  function handleItemClick(item: NotificationItem) {
    if (!item.isRead) void markRead(item.id);
    setOpen(false);
    router.push(notificationHref(item));
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {/* Badge is hidden entirely when the count is zero (Section 5). */}
        {unreadCount > 0 ? (
          <span className="absolute right-0 top-0 flex h-4 min-w-4 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] font-semibold leading-none text-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <>
          {/* Click-outside backdrop. */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed right-4 top-16 z-50 w-80 overflow-hidden rounded-md border bg-background shadow-lg sm:w-96"
          >
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => void markAllRead()}
                >
                  Mark all as read
                </button>
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Inbox className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-muted-foreground">No notifications yet.</p>
                </div>
              ) : (
                notifications.map((item) => {
                  const meta = TYPE_META[item.type] ?? TYPE_META.TripReminder;
                  const Icon = meta.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50',
                        !item.isRead && 'bg-secondary/40'
                      )}
                      onClick={() => handleItemClick(item)}
                    >
                      <span className={cn('mt-0.5 shrink-0', meta.iconClass)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm',
                            !item.isRead && 'font-semibold text-foreground'
                          )}
                        >
                          {item.message}
                        </span>
                        {item.relatedRide ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.relatedRide.sourceAddress}{' '}
                            <span className="text-muted-foreground">&rarr;</span>{' '}
                            {item.relatedRide.destinationAddress}
                          </span>
                        ) : null}
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </span>
                      {!item.isRead ? (
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            meta.dotClass
                          )}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}

      {toast ? (
        <Link
          href={notificationHref(toast)}
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-md border bg-background p-4 shadow-lg"
          onClick={() => setToast(null)}
        >
          {(() => {
            const meta = TYPE_META[toast.type] ?? TYPE_META.TripReminder;
            const Icon = meta.icon;
            return (
              <>
                <span className={cn('mt-0.5 shrink-0', meta.iconClass)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{toast.message}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatRelativeTime(toast.createdAt)}
                  </span>
                </span>
              </>
            );
          })()}
        </Link>
      ) : null}
    </div>
  );
}
