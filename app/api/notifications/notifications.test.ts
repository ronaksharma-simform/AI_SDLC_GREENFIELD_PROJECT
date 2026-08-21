import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockNotificationFindMany, mockNotificationUpdateMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockNotificationFindMany: vi.fn(),
  mockNotificationUpdateMany: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findMany: mockNotificationFindMany,
      updateMany: mockNotificationUpdateMany
    }
  }
}));

import { GET, PATCH } from './route';

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_ID = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const session = { user: { id: USER_ID, email: 'u@example.com', name: 'User', role: 'USER' } };

function notificationWith(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n-1',
    userId: USER_ID,
    type: 'RideRequestReceived',
    title: 'New ride request',
    message: 'New ride request from Priya',
    relatedRideId: 'ride-1',
    relatedRequestId: 'req-1',
    isRead: false,
    createdAt: '2026-08-21T12:00:00.000Z',
    relatedRide: {
      id: 'ride-1',
      sourceAddress: 'Home',
      destinationAddress: 'Office',
      departureTime: '2026-08-22T09:00:00.000Z',
      status: 'ACTIVE'
    },
    ...overrides
  };
}

describe('GET /api/notifications', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockNotificationFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockNotificationFindMany).not.toHaveBeenCalled();
  });

  it('lists only the caller\'s notifications, most recent first', async () => {
    mockNotificationFindMany.mockResolvedValue([notificationWith()]);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.notifications).toHaveLength(1);
    expect(body.notifications[0].message).toBe('New ride request from Priya');

    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: {
        relatedRide: {
          select: {
            id: true,
            sourceAddress: true,
            destinationAddress: true,
            departureTime: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockNotificationFindMany.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});

describe('PATCH /api/notifications', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockNotificationUpdateMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PATCH();

    expect(res.status).toBe(401);
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
  });

  it('marks only the caller\'s unread notifications as read and returns the count', async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 3 });

    const res = await PATCH();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(3);

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, isRead: false },
      data: { isRead: true }
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockNotificationUpdateMany.mockRejectedValue(new Error('db down'));

    const res = await PATCH();

    expect(res.status).toBe(500);
  });
});
