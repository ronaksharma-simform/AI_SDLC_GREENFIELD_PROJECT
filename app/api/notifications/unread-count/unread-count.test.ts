import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockNotificationCount } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockNotificationCount: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notification: {
      count: mockNotificationCount
    }
  }
}));

import { GET } from './route';

const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const session = { user: { id: USER_ID, email: 'u@example.com', name: 'User', role: 'USER' } };

describe('GET /api/notifications/unread-count', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockNotificationCount.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockNotificationCount).not.toHaveBeenCalled();
  });

  it('returns the unread count for the bell badge', async () => {
    mockNotificationCount.mockResolvedValue(4);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(4);

    expect(mockNotificationCount).toHaveBeenCalledWith({
      where: { userId: USER_ID, isRead: false }
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockNotificationCount.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
