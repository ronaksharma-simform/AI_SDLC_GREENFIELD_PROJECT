import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockRideFindUnique, mockRideUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mockRideUpdate: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: {
      findUnique: mockRideFindUnique,
      update: mockRideUpdate
    }
  }
}));

import { PATCH } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const session = { user: { id: PROVIDER_ID, email: 'p@example.com', name: 'Provider', role: 'DRIVER' } };

const baseRide = {
  id: RIDE_ID,
  providerId: PROVIDER_ID,
  vehicleId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  sourceAddress: 'Downtown',
  destinationAddress: 'Airport',
  departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  seatsTotal: 4,
  seatsAvailable: 3,
  status: 'ACTIVE',
  notes: null,
  totalCost: null,
  costFinalizedAt: null
};

function params(id = RIDE_ID) {
  return { params: Promise.resolve({ id }) };
}

function request(body?: string, method = 'PATCH'): Request {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(`http://localhost/api/rides/${RIDE_ID}/cost`, { method, headers, body });
}

describe('PATCH /api/rides/{id}/cost', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PATCH(request(JSON.stringify({ totalCost: 12000 })), params());

    expect(res.status).toBe(401);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed ride id', async () => {
    const res = await PATCH(request(JSON.stringify({ totalCost: 12000 })), params('nope'));

    expect(res.status).toBe(400);
  });

  it('returns 400 for a zero or negative totalCost', async () => {
    const res = await PATCH(request(JSON.stringify({ totalCost: 0 })), params());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.totalCost[0]).toContain('positive');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a ride owned by another user', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, providerId: OTHER_USER_ID });

    const res = await PATCH(request(JSON.stringify({ totalCost: 12000 })), params());

    expect(res.status).toBe(404);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('sets the trip cost for an owned, uncompleted ride (PAY-1)', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    const updated = { ...baseRide, totalCost: 12000 };
    mockRideUpdate.mockResolvedValue(updated);

    const res = await PATCH(request(JSON.stringify({ totalCost: 12000 })), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ride.totalCost).toBe(12000);
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { totalCost: 12000 }
    });
  });

  it('clears the trip cost when null is sent (PAY-9)', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, totalCost: 12000 });
    mockRideUpdate.mockResolvedValue({ ...baseRide, totalCost: null });

    const res = await PATCH(request(JSON.stringify({ totalCost: null })), params());

    expect(res.status).toBe(200);
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { totalCost: null }
    });
  });

  it('returns 409 once the ride is completed (split frozen, PAY-5)', async () => {
    mockRideFindUnique.mockResolvedValue({
      ...baseRide,
      totalCost: 12000,
      costFinalizedAt: '2026-08-20T00:00:00.000Z'
    });

    const res = await PATCH(request(JSON.stringify({ totalCost: 15000 })), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('locked');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    mockRideUpdate.mockRejectedValue(new Error('db down'));

    const res = await PATCH(request(JSON.stringify({ totalCost: 12000 })), params());

    expect(res.status).toBe(500);
  });
});
