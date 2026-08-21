import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockRideFindMany,
  mockTransaction,
  mockRideUpdateMany,
  mockNotificationCreate
} = vi.hoisted(() => ({
  mockRideFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockRideUpdateMany: vi.fn(),
  mockNotificationCreate: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: { findMany: mockRideFindMany },
    $transaction: mockTransaction
  }
}));

import { processTripReminders, REMINDER_WINDOW_MINUTES, REMINDER_TOLERANCE_MINUTES } from '@/lib/reminders';

const NOW = new Date('2026-08-21T12:00:00.000Z');
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_1 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const SEEKER_2 = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const REQUEST_1 = 'c0ffee00-0000-4000-8000-000000000000';
const REQUEST_2 = 'c0ffee01-0000-4000-8000-000000000000';

/** A ride fixture whose only requests are the ACCEPTED ones (the query already
 * filters them; we only mock what comes back). */
function rideFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: RIDE_ID,
    providerId: PROVIDER_ID,
    destinationAddress: 'Airport',
    provider: { id: PROVIDER_ID },
    requests: [
      { id: REQUEST_1, seekerId: SEEKER_1 },
      { id: REQUEST_2, seekerId: SEEKER_2 }
    ],
    ...overrides
  };
}

/** Minimal transaction facade exposing the delegates processTripReminders uses. */
function txFacade() {
  return {
    ride: { updateMany: mockRideUpdateMany },
    notification: { create: mockNotificationCreate }
  };
}

describe('processTripReminders', () => {
  beforeEach(() => {
    mockRideFindMany.mockReset();
    mockTransaction.mockReset();
    mockRideUpdateMany.mockReset();
    mockNotificationCreate.mockReset();

    mockRideFindMany.mockResolvedValue([rideFixture()]);
    mockRideUpdateMany.mockResolvedValue({ count: 1 });
    mockNotificationCreate.mockResolvedValue({ id: 'notif' });
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(txFacade()));
  });

  it('uses the 15-minute target with a 1-minute tolerance either side (NOTIF-3 / NOTIF-8)', () => {
    expect(REMINDER_WINDOW_MINUTES).toBe(15);
    expect(REMINDER_TOLERANCE_MINUTES).toBe(1);
  });

  it('queries only ACTIVE/FULL rides without a reminder, within the departure window', async () => {
    await processTripReminders(NOW);

    const windowStart = new Date(NOW.getTime() + 14 * 60_000);
    const windowEnd = new Date(NOW.getTime() + 16 * 60_000);

    expect(mockRideFindMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['ACTIVE', 'FULL'] },
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
  });

  it('notifies the Provider and each accepted Seeker, then stamps reminderSentAt (NOTIF-3)', async () => {
    const result = await processTripReminders(NOW);

    expect(result).toEqual({ ridesProcessed: 1, notificationsCreated: 3 });

    // The ride is claimed atomically before any notification is written.
    expect(mockRideUpdateMany).toHaveBeenCalledWith({
      where: { id: RIDE_ID, reminderSentAt: null },
      data: { reminderSentAt: NOW }
    });

    expect(mockNotificationCreate).toHaveBeenCalledTimes(3);
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: PROVIDER_ID,
        type: 'TripReminder',
        title: 'Trip reminder',
        message: 'Your ride to Airport departs in 15 minutes',
        relatedRideId: RIDE_ID,
        relatedRequestId: null
      }
    });
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: SEEKER_1,
        type: 'TripReminder',
        title: 'Trip reminder',
        message: 'Your ride to Airport departs in 15 minutes',
        relatedRideId: RIDE_ID,
        relatedRequestId: REQUEST_1
      }
    });
    expect(mockNotificationCreate).toHaveBeenCalledWith({
      data: {
        userId: SEEKER_2,
        type: 'TripReminder',
        title: 'Trip reminder',
        message: 'Your ride to Airport departs in 15 minutes',
        relatedRideId: RIDE_ID,
        relatedRequestId: REQUEST_2
      }
    });
  });

  it('does not double-send when a concurrent run claimed the ride first (NOTIF-4)', async () => {
    // The claim matches zero rows → this run must not create notifications.
    mockRideUpdateMany.mockResolvedValue({ count: 0 });

    const result = await processTripReminders(NOW);

    expect(result).toEqual({ ridesProcessed: 0, notificationsCreated: 0 });
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it('processes multiple rides independently', async () => {
    const secondRide = rideFixture({
      id: '2b2b2b2b-0000-4000-8000-000000000000',
      providerId: 'cccccccc-dddd-4eee-8fff-000000000000',
      destinationAddress: 'Mall',
      requests: [{ id: 'deadbeef-0000-4000-8000-000000000000', seekerId: 'dddddddd-dddd-4eee-8fff-000000000000' }]
    });
    mockRideFindMany.mockResolvedValue([rideFixture(), secondRide]);

    const result = await processTripReminders(NOW);

    expect(result).toEqual({ ridesProcessed: 2, notificationsCreated: 5 });
    expect(mockRideUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockNotificationCreate).toHaveBeenCalledTimes(5);
  });
});
