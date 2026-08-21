import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockNotificationFindUnique, mockNotificationUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockNotificationFindUnique: vi.fn(),
  mockNotificationUpdate: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      findUnique: mockNotificationFindUnique,
      update: mockNotificationUpdate
    }
  }
}));

import { PATCH } from './route';

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_ID = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const NOTIFICATION_ID = 'c0ffee00-0000-4000-8000-000000000000';

const session = { user: { id: USER_ID, email: 'u@example.com', name: 'User', role: 'USER' } };

function params(id = NOTIFICATION_ID) {
  return { params: Promise.resolve({ id }) };
}

function notificationWith(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    type: 'RideRequestReceived',
    title: 'New ride request',
    message: 'New ride request from Priya',
    relatedRideId: null,
    relatedRequestId: null,
    isRead: false,
    createdAt: '2026-08-21T12:00:00.000Z',
    ...overrides
  };
}

describe('PATCH /api/notifications/{id}/read', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockNotificationFindUnique.mockReset();
    mockNotificationUpdate.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(401);
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed notification id', async () => {
    const res = await PATCH(new Request('http://localhost'), params('nope'));

    expect(res.status).toBe(400);
    expect(mockNotificationFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the notification does not exist', async () => {
    mockNotificationFindUnique.mockResolvedValue(null);

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the notification belongs to another user (Section 15)', async () => {
    mockNotificationFindUnique.mockResolvedValue(notificationWith({ userId: OTHER_ID }));

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
    expect(mockNotificationUpdate).not.toHaveBeenCalled();
  });

  it('marks the caller\'s own notification as read', async () => {
    mockNotificationFindUnique.mockResolvedValue(notificationWith());
    const updated = notificationWith({ isRead: true });
    mockNotificationUpdate.mockResolvedValue(updated);

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.notification.isRead).toBe(true);
    expect(mockNotificationUpdate).toHaveBeenCalledWith({
      where: { id: NOTIFICATION_ID },
      data: { isRead: true }
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockNotificationFindUnique.mockResolvedValue(notificationWith());
    mockNotificationUpdate.mockRejectedValue(new Error('db down'));

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(500);
  });
});
