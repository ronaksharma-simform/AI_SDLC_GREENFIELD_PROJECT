import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockRideFindUnique, mockRequestFindMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mockRequestFindMany: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: { findUnique: mockRideFindUnique },
    rideRequest: { findMany: mockRequestFindMany }
  }
}));

import { GET } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const session = { user: { id: PROVIDER_ID, email: 'p@example.com', name: 'Provider', role: 'DRIVER' } };

function completedRide(overrides: Record<string, unknown> = {}) {
  return {
    id: RIDE_ID,
    providerId: PROVIDER_ID,
    vehicleId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
    sourceAddress: 'Downtown',
    destinationAddress: 'Airport',
    departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    seatsTotal: 4,
    seatsAvailable: 1,
    status: 'COMPLETED',
    notes: null,
    totalCost: 12000,
    costFinalizedAt: '2026-08-20T00:00:00.000Z',
    ...overrides
  };
}

function params(id = RIDE_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/rides/{id}/settlement', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRequestFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(401);
  });

  it('returns 404 for a ride owned by another user (PAY-7 provider only)', async () => {
    mockRideFindUnique.mockResolvedValue({ ...completedRide(), providerId: OTHER_USER_ID });

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
    expect(mockRequestFindMany).not.toHaveBeenCalled();
  });

  it('returns 400 for a ride that is not yet completed', async () => {
    mockRideFindUnique.mockResolvedValue(completedRide({ status: 'ACTIVE', costFinalizedAt: null }));

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('completed');
  });

  it('returns 400 for a completed ride with no declared cost (PAY-9)', async () => {
    mockRideFindUnique.mockResolvedValue(completedRide({ totalCost: null }));

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no declared trip cost');
  });

  it('lists every accepted Seeker with shareAmount and paymentStatus (PAY-7)', async () => {
    mockRideFindUnique.mockResolvedValue(completedRide());
    mockRequestFindMany.mockResolvedValue([
      {
        id: 'r1',
        seatsRequested: 1,
        shareAmount: 3000,
        paymentStatus: 'UNPAID',
        paidAt: null,
        seeker: { id: 's1', name: 'Priya', email: 'priya@example.com' }
      },
      {
        id: 'r2',
        seatsRequested: 2,
        shareAmount: 3000,
        paymentStatus: 'PAID',
        paidAt: '2026-08-21T00:00:00.000Z',
        seeker: { id: 's2', name: null, email: 'anuj@example.com' }
      }
    ]);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settlement.totalCost).toBe(12000);
    expect(body.settlement.rows).toHaveLength(2);
    expect(body.settlement.rows[0]).toEqual({
      requestId: 'r1',
      seekerId: 's1',
      seekerName: 'Priya',
      seatsRequested: 1,
      shareAmount: 3000,
      paymentStatus: 'UNPAID',
      paidAt: null
    });
    expect(body.settlement.rows[1].seekerName).toBe('anuj@example.com');
    expect(mockRequestFindMany).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID, status: 'ACCEPTED' },
      include: { seeker: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });
  });
});
