import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockRequestFindUnique, mockRequestUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRequestFindUnique: vi.fn(),
  mockRequestUpdate: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rideRequest: {
      findUnique: mockRequestFindUnique,
      update: mockRequestUpdate
    }
  }
}));

import { PATCH } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const REQUEST_ID = 'c0ffee00-0000-4000-8000-000000000000';

const session = { user: { id: PROVIDER_ID, email: 'p@example.com', name: 'Provider', role: 'DRIVER' } };

const ride = {
  id: RIDE_ID,
  providerId: PROVIDER_ID,
  sourceAddress: 'Downtown',
  destinationAddress: 'Airport',
  departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  seatsTotal: 4,
  seatsAvailable: 1,
  status: 'COMPLETED',
  totalCost: 12000,
  costFinalizedAt: '2026-08-20T00:00:00.000Z'
};

function requestWith(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    rideId: RIDE_ID,
    seekerId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    seatsRequested: 1,
    status: 'ACCEPTED',
    message: null,
    shareAmount: 3000,
    paymentStatus: 'UNPAID',
    paidAt: null,
    ride,
    ...overrides
  };
}

function params(id = REQUEST_ID) {
  return { params: Promise.resolve({ id }) };
}

function request(body?: string): Request {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(`http://localhost/api/requests/${REQUEST_ID}/payment`, {
    method: 'PATCH',
    headers,
    body
  });
}

describe('PATCH /api/requests/{id}/payment', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRequestFindUnique.mockReset();
    mockRequestUpdate.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PATCH(request(JSON.stringify({ paymentStatus: 'PAID' })), params());

    expect(res.status).toBe(401);
    expect(mockRequestUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid paymentStatus', async () => {
    const res = await PATCH(request(JSON.stringify({ paymentStatus: 'DONE' })), params());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.paymentStatus).toBeDefined();
    expect(mockRequestUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a request on a ride owned by another user', async () => {
    mockRequestFindUnique.mockResolvedValue(
      requestWith({ ride: { ...ride, providerId: OTHER_USER_ID } })
    );

    const res = await PATCH(request(JSON.stringify({ paymentStatus: 'PAID' })), params());

    expect(res.status).toBe(404);
    expect(mockRequestUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 when the request has no frozen share (never accepted or no cost)', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith({ status: 'PENDING', shareAmount: null }));

    const res = await PATCH(request(JSON.stringify({ paymentStatus: 'PAID' })), params());

    expect(res.status).toBe(409);
    expect(mockRequestUpdate).not.toHaveBeenCalled();
  });

  it('marks a Seeker share as PAID and stamps paidAt (PAY-6)', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith());
    const updated = requestWith({ paymentStatus: 'PAID', paidAt: '2026-08-21T00:00:00.000Z' });
    mockRequestUpdate.mockResolvedValue(updated);

    const res = await PATCH(request(JSON.stringify({ paymentStatus: 'PAID' })), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.paymentStatus).toBe('PAID');
    expect(mockRequestUpdate).toHaveBeenCalledWith({
      where: { id: REQUEST_ID },
      data: { paymentStatus: 'PAID', paidAt: expect.any(Date) }
    });
  });

  it('reverts a Seeker share to UNPAID and clears paidAt (correct a mistake, §11.4)', async () => {
    mockRequestFindUnique.mockResolvedValue(
      requestWith({ paymentStatus: 'PAID', paidAt: '2026-08-21T00:00:00.000Z' })
    );
    mockRequestUpdate.mockResolvedValue(requestWith({ paymentStatus: 'UNPAID', paidAt: null }));

    const res = await PATCH(request(JSON.stringify({ paymentStatus: 'UNPAID' })), params());

    expect(res.status).toBe(200);
    expect(mockRequestUpdate).toHaveBeenCalledWith({
      where: { id: REQUEST_ID },
      data: { paymentStatus: 'UNPAID', paidAt: null }
    });
  });
});
