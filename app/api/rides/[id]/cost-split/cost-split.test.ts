import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockRideFindUnique, mockRequestFindFirst, mockRequestFindMany } =
  vi.hoisted(() => ({
    mockGetSession: vi.fn(),
    mockRideFindUnique: vi.fn(),
    mockRequestFindFirst: vi.fn(),
    mockRequestFindMany: vi.fn()
  }));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: { findUnique: mockRideFindUnique },
    rideRequest: {
      findFirst: mockRequestFindFirst,
      findMany: mockRequestFindMany
    }
  }
}));

import { GET } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const UNRELATED_ID = 'cccccccc-dddd-4eee-8fff-000000000000';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const providerSession = { user: { id: PROVIDER_ID, email: 'p@example.com', name: null, role: 'DRIVER' } };
const seekerSession = { user: { id: SEEKER_ID, email: 's@example.com', name: null, role: 'USER' } };

function rideWith(overrides: Record<string, unknown> = {}) {
  return {
    id: RIDE_ID,
    providerId: PROVIDER_ID,
    vehicleId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
    sourceAddress: 'Downtown',
    destinationAddress: 'Airport',
    departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    seatsTotal: 4,
    seatsAvailable: 1,
    status: 'ACTIVE',
    notes: null,
    totalCost: 12000,
    costFinalizedAt: null,
    ...overrides
  };
}

function params(id = RIDE_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/rides/{id}/cost-split', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRequestFindFirst.mockReset();
    mockRequestFindMany.mockReset();
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(401);
  });

  it('returns 404 for an unrelated user (never exposes the split to outsiders, PAY-3)', async () => {
    mockGetSession.mockResolvedValue(seekerSession);
    mockRideFindUnique.mockResolvedValue(rideWith());
    mockRequestFindFirst.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
    expect(mockRequestFindMany).not.toHaveBeenCalled();
  });

  it('returns a null costSplit for a ride with no declared cost (PAY-9)', async () => {
    mockGetSession.mockResolvedValue(providerSession);
    mockRideFindUnique.mockResolvedValue(rideWith({ totalCost: null }));

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.costSplit.totalCost).toBeNull();
    expect(body.costSplit.costPerSeat).toBeNull();
    expect(body.costSplit.status).toBeNull();
    expect(mockRequestFindMany).not.toHaveBeenCalled();
  });

  it('gives the provider the live split (PAY-2)', async () => {
    mockGetSession.mockResolvedValue(providerSession);
    mockRideFindUnique.mockResolvedValue(rideWith());
    mockRequestFindMany.mockResolvedValue([{ id: 'r1', shareAmount: null }, { id: 'r2', shareAmount: null }]);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    // ₹120 / (provider + 2 accepted) = 12000/3 = 4000 paise.
    expect(body.costSplit.costPerSeat).toBe(4000);
    expect(body.costSplit.acceptedCount).toBe(2);
    expect(body.costSplit.status).toBe('live');
    expect(body.costSplit.myShare).toBeNull();
    expect(mockRequestFindFirst).not.toHaveBeenCalled();
  });

  it('gives a Pending Seeker the live split without a myShare row', async () => {
    mockGetSession.mockResolvedValue(seekerSession);
    mockRideFindUnique.mockResolvedValue(rideWith());
    mockRequestFindFirst.mockResolvedValue({ status: 'PENDING', shareAmount: null, paymentStatus: 'UNPAID', paidAt: null });
    mockRequestFindMany.mockResolvedValue([{ id: 'r1', shareAmount: null }]);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.costSplit.costPerSeat).toBe(6000); // 12000 / 2
    expect(body.costSplit.myShare).toBeNull();
  });

  it('gives an Accepted Seeker their own frozen share only (PAY-8)', async () => {
    mockGetSession.mockResolvedValue(seekerSession);
    mockRideFindUnique.mockResolvedValue(
      rideWith({ status: 'COMPLETED', costFinalizedAt: '2026-08-20T00:00:00.000Z' })
    );
    mockRequestFindFirst.mockResolvedValue({
      status: 'ACCEPTED',
      shareAmount: 3000,
      paymentStatus: 'UNPAID',
      paidAt: null
    });
    mockRequestFindMany.mockResolvedValue([{ id: 'r1', shareAmount: 3000 }]);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.costSplit.status).toBe('frozen');
    expect(body.costSplit.costPerSeat).toBe(3000);
    expect(body.costSplit.myShare).toEqual({
      shareAmount: 3000,
      paymentStatus: 'UNPAID',
      paidAt: null
    });
  });

  it('returns 404 when the ride does not exist', async () => {
    mockGetSession.mockResolvedValue(providerSession);
    mockRideFindUnique.mockResolvedValue(null);

    const res = await GET(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
  });
});
