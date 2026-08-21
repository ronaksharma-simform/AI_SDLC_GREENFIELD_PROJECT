import type { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Notification creation helpers (Part B — Notifications Module).
 *
 * The Notifications module owns HOW a notification is persisted and delivered
 * in-app. The trigger points (ride-request created / accepted / rejected and the
 * scheduled Trip Reminder job) decide WHEN one must fire; they funnel through
 * `notifyUser` below, which is the only place a notification is written.
 *
 * There is deliberately NO public "create notification" endpoint — notifications
 * are only ever created internally by these trigger paths (Section 13).
 */

/** Context supplied by a trigger point. Used to build the message and to
 * deep-link into the relevant ride/request view (Section 6). */
export interface NotifyContext {
  /** The ride this notification relates to (navigation target). */
  rideId?: string | null;
  /** The specific ride request this notification relates to, where applicable. */
  requestId?: string | null;
  /** Display name (or email) of the Seeker who made the request. */
  seekerName?: string | null;
  /** Human-readable destination, used by the Trip Reminder message. */
  destinationAddress?: string | null;
  /** Display name (or email) of the message sender (New Message). */
  senderName?: string | null;
}

/** Fixed headline for each notification type (Part B §9.1 `title`). */
const NOTIFICATION_TITLES: Record<NotificationType, string> = {
  RideRequestReceived: 'New ride request',
  RideRequestAccepted: 'Request accepted',
  RideRequestRejected: 'Request rejected',
  TripReminder: 'Trip reminder',
  NewMessage: 'New message'
};

/**
 * Builds the human-readable message for a notification (Part B §9.1 `message`).
 *
 * Mirrors the example copy from the spec:
 *   - RideRequestReceived:  "New ride request from Priya"
 *   - RideRequestAccepted:  "Your request was accepted"
 *   - TripReminder:         "Your ride to Office departs in 15 minutes"
 */
export function buildNotificationMessage(type: NotificationType, ctx: NotifyContext = {}): string {
  switch (type) {
    case 'RideRequestReceived':
      return `New ride request from ${ctx.seekerName ?? 'a rider'}`;
    case 'RideRequestAccepted':
      return 'Your request was accepted';
    case 'RideRequestRejected':
      return 'Your request was rejected';
    case 'TripReminder':
      return `Your ride to ${ctx.destinationAddress ?? 'your destination'} departs in 15 minutes`;
    case 'NewMessage':
      return `New message from ${ctx.senderName ?? 'a rider'}`;
  }
}

/** Returns the fixed headline for a notification type. */
export function buildNotificationTitle(type: NotificationType): string {
  return NOTIFICATION_TITLES[type];
}

/** Minimal shape of a persisted notification returned to callers/tests. */
export interface NotificationCreated {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedRideId: string | null;
  relatedRequestId: string | null;
  isRead: boolean;
  createdAt: Date;
}

/**
 * Creates one notification for a single recipient.
 *
 * Every trigger path (Request Received / Request Accepted / Request Rejected,
 * and the Trip Reminder job) calls this. The recipient must resolve to an
 * existing user (Section 12 — Validation Rules); otherwise the notification is
 * skipped and `null` is returned.
 *
 * `relatedRideId` / `relatedRequestId` are optional and used for navigation; the
 * database enforces referential integrity when they are provided.
 */
export async function notifyUser(
  userId: string,
  type: NotificationType,
  ctx: NotifyContext = {}
): Promise<NotificationCreated | null> {
  const recipient = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  if (!recipient) {
    return null;
  }

  return prisma.notification.create({
    data: {
      userId,
      type,
      title: buildNotificationTitle(type),
      message: buildNotificationMessage(type, ctx),
      relatedRideId: ctx.rideId ?? null,
      relatedRequestId: ctx.requestId ?? null
    }
  });
}
