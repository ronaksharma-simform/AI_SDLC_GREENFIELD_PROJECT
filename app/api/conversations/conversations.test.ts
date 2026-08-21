import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockConversationFindMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockConversationFindMany: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: {
      findMany: mockConversationFindMany
    }
  }
}));

import { GET } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_ID = 'cccccccc-dddd-4eee-8fff-000000000000';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const session = { user: { id: PROVIDER_ID, email: 'p@example.com', name: 'Provider', role: 'DRIVER' } };

function conversationWith(overrides: Record<string, unknown> = {}) {
  return {
    id: 'convo-1',
    rideId: RIDE_ID,
    providerId: PROVIDER_ID,
    seekerId: SEEKER_ID,
    status: 'ACTIVE',
    createdAt: '2026-08-20T00:00:00.000Z',
    closedAt: null,
    ride: { id: RIDE_ID, sourceAddress: 'Home', destinationAddress: 'Office', status: 'ACTIVE' },
    provider: { id: PROVIDER_ID, name: 'Provider', email: 'p@example.com' },
    seeker: { id: SEEKER_ID, name: 'Seeker', email: 's@example.com' },
    messages: [
      {
        id: 'm-1',
        conversationId: 'convo-1',
        senderId: SEEKER_ID,
        content: 'See you there!',
        sentAt: '2026-08-20T12:00:00.000Z',
        readAt: null
      }
    ],
    _count: { messages: 1 },
    ...overrides
  };
}

describe('GET /api/conversations', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockConversationFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockConversationFindMany).not.toHaveBeenCalled();
  });

  it('lists conversations where the caller is a participant, with the other participant as otherParticipant', async () => {
    mockConversationFindMany.mockResolvedValue([conversationWith()]);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.conversations).toHaveLength(1);
    const item = body.conversations[0];
    // Provider is viewing → the Seeker is the other participant.
    expect(item.otherParticipant.id).toBe(SEEKER_ID);
    expect(item.lastMessage.content).toBe('See you there!');
    expect(item.unreadCount).toBe(1);
    expect(item.ride.sourceAddress).toBe('Home');
  });

  it('orders conversations by most recent activity first', async () => {
    const newer = conversationWith({
      id: 'convo-2',
      messages: [
        {
          id: 'm-2',
          conversationId: 'convo-2',
          senderId: SEEKER_ID,
          content: 'newer',
          sentAt: '2026-08-21T12:00:00.000Z',
          readAt: null
        }
      ]
    });
    mockConversationFindMany.mockResolvedValue([conversationWith(), newer]);

    const res = await GET();
    const body = await res.json();

    expect(body.conversations[0].id).toBe('convo-2');
  });

  it('returns 500 for an unexpected database error', async () => {
    mockConversationFindMany.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
