import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockConversationFindUnique, mockMessageUpdateMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockConversationFindUnique: vi.fn(),
  mockMessageUpdateMany: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: {
      findUnique: mockConversationFindUnique
    },
    message: {
      updateMany: mockMessageUpdateMany
    }
  }
}));

import { PATCH } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_ID = 'cccccccc-dddd-4eee-8fff-000000000000';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const CONVERSATION_ID = 'b0b0b0b0-0000-4000-8000-000000000000';

const session = { user: { id: PROVIDER_ID, email: 'p@example.com', name: 'Provider', role: 'DRIVER' } };

function fullConversation() {
  return {
    id: CONVERSATION_ID,
    rideId: RIDE_ID,
    providerId: PROVIDER_ID,
    seekerId: SEEKER_ID,
    status: 'ACTIVE',
    createdAt: '2026-08-20T00:00:00.000Z',
    closedAt: null,
    ride: { id: RIDE_ID, sourceAddress: 'Home', destinationAddress: 'Office', status: 'ACTIVE' },
    provider: { id: PROVIDER_ID, name: 'Provider', email: 'p@example.com' },
    seeker: { id: SEEKER_ID, name: 'Seeker', email: 's@example.com' }
  };
}

function params(id = CONVERSATION_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/conversations/{id}/read', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockConversationFindUnique.mockReset();
    mockMessageUpdateMany.mockReset();
    mockMessageUpdateMany.mockResolvedValue({ count: 2 });
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed conversation id', async () => {
    const res = await PATCH(new Request('http://localhost'), params('nope'));

    expect(res.status).toBe(400);
  });

  it('returns 404 for a conversation the caller cannot access (REQ-2)', async () => {
    mockConversationFindUnique.mockResolvedValue({
      ...fullConversation(),
      providerId: OTHER_ID,
      seekerId: OTHER_ID
    });

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
    expect(mockMessageUpdateMany).not.toHaveBeenCalled();
  });

  it('marks incoming messages as read', async () => {
    mockConversationFindUnique.mockResolvedValue(fullConversation());

    const res = await PATCH(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.updated).toBe(2);
    expect(mockMessageUpdateMany).toHaveBeenCalledWith({
      where: {
        conversationId: CONVERSATION_ID,
        senderId: { not: PROVIDER_ID },
        readAt: null
      },
      data: { readAt: expect.any(Date) }
    });
  });
});
