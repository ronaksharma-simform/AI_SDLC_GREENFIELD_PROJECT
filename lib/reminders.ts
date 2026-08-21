import { prisma } from '@/lib/prisma';
import { buildNotificationMessage, buildNotificationTitle } from '@/lib/notifications';

/**
 * Scheduled Trip Reminder job (NOTIF-3 / NOTIF-8).
 *
 * Nothing "happens" to trigger a reminder other than time passing, so this job
 * runs on a recurring schedule (every 1–2 minutes — see `GET /api/cron/trip-reminders`
 * for the HTTP entry point an external scheduler calls). Each run finds rides
 * whose departure falls inside the reminder window and creates a TripReminder
 * notification for the Provider and for every Seeker with an Accepted request.
 *
 * The 15-minute mark is a target, not an exact guarantee (Section 14 — Business
 * Rules): the actual send time depends on the job's run interval and sits within
 * a tolerance window (14–16 minutes before departure).
 *
 * NOTIF-4 (no duplicate reminders): each ride is claimed atomically before any
 * notification is written. The claim sets `reminderSentAt` with an
 * `updateMany({ where: { reminderSentAt: null } })`; if a concurrent run read
 * the same ride first, its claim matches zero rows and it skips the ride.
 * Because the claim and the notification inserts share one transaction, a
 * failure to write notifications rolls the claim back and a later run retries.
 */

/** How far before departure the reminder targets, in minutes. */
export const REMINDER_WINDOW_MINUTES = 15;

/** Tolerance either side of the target, in minutes, absorbing the job's own
 * run interval. A ride departs 14–16 minutes from now inside this window. */
export const REMINDER_TOLERANCE_MINUTES = 1;

/** Rides eligible for a reminder (Section 14 — a cancelled ride is skipped). */
const REMINDER_RIDE_STATUSES = ['ACTIVE', 'FULL'] as const;

export interface TripReminderRunResult {
  /** Number of rides for which reminders were actually generated. */
  ridesProcessed: number;
  /** Total notifications created (one per recipient). */
  notificationsCreated: number;
}

export async function processTripReminders(
  now: Date = new Date()
): Promise<TripReminderRunResult> {
  const windowStart = new Date(
    now.getTime() + (REMINDER_WINDOW_MINUTES - REMINDER_TOLERANCE_MINUTES) * 60_000
  );
  const windowEnd = new Date(
    now.getTime() + (REMINDER_WINDOW_MINUTES + REMINDER_TOLERANCE_MINUTES) * 60_000
  );

  const rides = await prisma.ride.findMany({
    where: {
      status: { in: [...REMINDER_RIDE_STATUSES] },
      departureTime: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null
    },
    include: {
      provider: { select: { id: true } },
      requests: {
        where: { status: 'ACCEPTED' },
        select: { id: true, seekerId: true }
      }
    }
  });

  let ridesProcessed = 0;
  let notificationsCreated = 0;

  for (const ride of rides) {
    const created = await prisma.$transaction(async (tx) => {
      // NOTIF-4: atomically claim this ride so a concurrent run cannot double-send.
      const claim = await tx.ride.updateMany({
        where: { id: ride.id, reminderSentAt: null },
        data: { reminderSentAt: now }
      });
      if (claim.count === 0) return 0;

      const message = buildNotificationMessage('TripReminder', {
        destinationAddress: ride.destinationAddress
      });
      const title = buildNotificationTitle('TripReminder');

      let count = 0;

      // Provider reminder for the whole ride.
      await tx.notification.create({
        data: {
          userId: ride.providerId,
          type: 'TripReminder',
          title,
          message,
          relatedRideId: ride.id,
          relatedRequestId: null
        }
      });
      count += 1;

      // One reminder per Seeker with an Accepted request on the ride.
      for (const request of ride.requests) {
        await tx.notification.create({
          data: {
            userId: request.seekerId,
            type: 'TripReminder',
            title,
            message,
            relatedRideId: ride.id,
            relatedRequestId: request.id
          }
        });
        count += 1;
      }

      return count;
    });

    if (created > 0) {
      ridesProcessed += 1;
      notificationsCreated += created;
    }
  }

  return { ridesProcessed, notificationsCreated };
}
