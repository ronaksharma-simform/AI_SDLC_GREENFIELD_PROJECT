import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetSession,
  mockConversationFindUnique,
  mockMessageFindMany,
  mockMessageCreate,
  mockNotifyUser
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockConversationFindUnique: vi.fn(),
  mockMessageFindMany: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockNotifyUser: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/notifications', () => ({
  notifyUser: mockNotifyUser
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    conversation: {
      findUnique: mockConversationFindUnique
    },
    message: {
      findMany: mockMessageFindMany,
      create: mockMessageCreate
    }
  }
}));

import { GET, POST } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_ID = 'cccccccc-dddd-4eee-8fff-000000000000';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const CONVERSATION_ID = 'b0b0b0b0-0000-4000-8000-000000000000';

const providerSession = { user: { id: PROVIDER_ID, email: 'p@example.com', name: 'Provider', role: 'DRIVER' } };
const seekerSession = { user: { id: SEEKER_ID, email: 's@example.com', name: 'Seeker', role: 'USER' } };

/** Full shape returned by findConversationForUser (includes relation records). */
function fullConversation(status: 'ACTIVE' | 'CLOSED' = 'ACTIVE') {
  return {
    id: CONVERSATION_ID,
    rideId: RIDE_ID,
    providerId: PROVIDER_ID,
    seekerId: SEEKER_ID,
    status,
    createdAt: '2026-08-20T00:00:00.000Z',
    closedAt: null,
    ride: { id: RIDE_ID, sourceAddress: 'Home', destinationAddress: 'Office', status: 'ACTIVE' },
    provider: { id: PROVIDER_ID, name: 'Provider', email: 'p@example.com' },
    seeker: { id: SEEKER_ID, name: 'Seeker', email: 's@example.com' }
  };
}

/** Lean shape returned by the POST route's direct findUnique call. */
function leanConversation(status: 'ACTIVE' | 'CLOSED' = 'ACTIVE') {
  return { id: CONVERSATION_ID, rideId: RIDE_ID, providerId: PROVIDER_ID, seekerId: SEEKER_ID, status };
}

function params(id = CONVERSATION_ID) {
  return { params: Promise.resolve({ id }) };
}

function jsonRequest(body: unknown): Request {
  return new Request(`http://localhost/api/conversations/${CONVERSATION_ID}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('GET /api/conversations/{id}/messages', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockConversationFindUnique.mockReset();
    mockMessageFindMany.mockReset();
    mockGetSession.mockResolvedValue(providerSession);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed conversation id', async () => {
    const res = await GET(new Request('http://localhost'), params('nope'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when the caller is not a participant (REQ-2)', async () => {
    mockConversationFindUnique.mockResolvedValue({
      ...fullConversation(),
      providerId: OTHER_ID,
      seekerId: OTHER_ID
    });

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
    expect(mockMessageFindMany).not.toHaveBeenCalled();
  });

  it('returns messages in chronological order', async () => {
    mockConversationFindUnique.mockResolvedValue(fullConversation());
    mockMessageFindMany.mockResolvedValue([
      { id: 'm-1', conversationId: CONVERSATION_ID, senderId: SEEKER_ID, content: 'hi', sentAt: '2026-08-20T12:00:00.000Z', readAt: null },
      { id: 'm-2', conversationId: CONVERSATION_ID, senderId: PROVIDER_ID, content: 'hello', sentAt: '2026-08-20T12:01:00.000Z', readAt: null }
    ]);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.conversation.status).toBe('ACTIVE');
    expect(body.messages).toHaveLength(2);
    expect(mockMessageFindMany).toHaveBeenCalledWith({
      where: { conversationId: CONVERSATION_ID },
      orderBy: { sentAt: 'asc' }
    });
  });
});

describe('POST /api/conversations/{id}/messages', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockConversationFindUnique.mockReset();
    mockMessageCreate.mockReset();
    mockNotifyUser.mockReset();
    mockGetSession.mockResolvedValue(providerSession);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(jsonRequest({ content: 'hi' }), params());

    expect(res.status).toBe(401);
  });

  it('returns 400 for an empty message', async () => {
    const res = await POST(jsonRequest({ content: '   ' }), params());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.content).toBeDefined();
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it('returns 404 when the caller is not a participant (REQ-2)', async () => {
    // Caller (provider session) is neither participant in the returned conversation.
    mockConversationFindUnique.mockResolvedValue({
      ...leanConversation(),
      providerId: OTHER_ID,
      seekerId: OTHER_ID
    });

    const res = await POST(jsonRequest({ content: 'hi' }), params());

    expect(res.status).toBe(404);
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it('returns 409 for a closed conversation (REQ-7)', async () => {
    mockConversationFindUnique.mockResolvedValue(leanConversation('CLOSED'));

    const res = await POST(jsonRequest({ content: 'hi' }), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('closed');
    expect(mockMessageCreate).not.toHaveBeenCalled();
  });

  it('sanitizes content, creates the message, and notifies the other participant (REQ-3, REQ-5)', async () => {
    mockConversationFindUnique.mockResolvedValue(leanConversation());
    mockMessageCreate.mockResolvedValue({
      id: 'm-1',
      conversationId: CONVERSATION_ID,
      senderId: PROVIDER_ID,
      content: 'See you <script>alert(1)</script>',
      sentAt: '2026-08-20T12:00:00.000Z',
      readAt: null
    });

    const res = await POST(jsonRequest({ content: 'See you <script>alert(1)</script>' }), params());

    expect(res.status).toBe(201);
    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        conversationId: CONVERSATION_ID,
        senderId: PROVIDER_ID,
        content: 'See you alert(1)'
      }
    });
    expect(mockNotifyUser).toHaveBeenCalledWith(SEEKER_ID, 'NewMessage', {
      rideId: RIDE_ID,
      senderName: 'Provider'
    });
  });
});
