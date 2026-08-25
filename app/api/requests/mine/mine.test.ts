import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockRequestFindMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRequestFindMany: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rideRequest: {
      findMany: mockRequestFindMany
    }
  }
}));

import { GET } from './route';

const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const session = { user: { id: SEEKER_ID, email: 'seeker@example.com', name: null, role: 'USER' } };

describe('GET /api/requests/mine', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRequestFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockRequestFindMany).not.toHaveBeenCalled();
  });

  it('lists only the caller\u2019s requests with ride context, newest first', async () => {
    const requests = [
      {
        id: 'r1',
        rideId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
        seekerId: SEEKER_ID,
        status: 'PENDING',
        ride: { id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', sourceAddress: 'Downtown' }
      }
    ];
    mockRequestFindMany.mockResolvedValue(requests);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toEqual(requests);

    expect(mockRequestFindMany).toHaveBeenCalledWith({
      where: { seekerId: SEEKER_ID },
      include: {
        ride: {
          include: {
            vehicle: true,
            provider: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRequestFindMany.mockRejectedValue(new Error('db down'));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
