import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetSession,
  mockRequestFindUnique,
  mockRequestUpdate,
  mockRideUpdate,
  mockRideFindUnique,
  mock$transaction,
  mockNotifyUser
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRequestFindUnique: vi.fn(),
  mockRequestUpdate: vi.fn(),
  mockRideUpdate: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mock$transaction: vi.fn(),
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
    rideRequest: {
      findUnique: mockRequestFindUnique,
      update: mockRequestUpdate
    },
    ride: {
      findUnique: mockRideFindUnique,
      update: mockRideUpdate
    },
    $transaction: mock$transaction
  }
}));

// Simulates Prisma's interactive transaction: the callback receives a `tx`
// facade backed by the same mocked delegates.
function mockTx(facade: Record<string, unknown>) {
  mock$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(facade));
}

import { PATCH as acceptPatch } from './accept/route';
import { PATCH as rejectPatch } from './reject/route';
import { PATCH as cancelPatch } from './cancel/route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_USER_ID = 'cccccccc-dddd-4eee-8fff-000000000000';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const REQUEST_ID = 'c0ffee00-0000-4000-8000-000000000000';

const providerSession = { user: { id: PROVIDER_ID, email: 'provider@example.com', name: null, role: 'DRIVER' } };
const seekerSession = { user: { id: SEEKER_ID, email: 'seeker@example.com', name: null, role: 'USER' } };

const ride = {
  id: RIDE_ID,
  providerId: PROVIDER_ID,
  vehicleId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  sourceAddress: 'Downtown',
  destinationAddress: 'Airport',
  departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  seatsTotal: 4,
  seatsAvailable: 3,
  status: 'ACTIVE',
  notes: null
};

function requestWith(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    rideId: RIDE_ID,
    seekerId: SEEKER_ID,
    seatsRequested: 2,
    status: 'PENDING',
    message: null,
    createdAt: '2026-08-20T00:00:00.000Z',
    respondedAt: null,
    ride,
    ...overrides
  };
}

function params(id = REQUEST_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/requests/{id}/accept', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRequestFindUnique.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mockRequestUpdate.mockReset();
    mock$transaction.mockReset();
    mockNotifyUser.mockReset();
    mockGetSession.mockResolvedValue(providerSession);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await acceptPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(401);
  });

  it('returns 404 for a request on a ride owned by another user', async () => {
    mockRequestFindUnique.mockResolvedValue(
      requestWith({ ride: { ...ride, providerId: OTHER_USER_ID } })
    );

    const res = await acceptPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
  });

  it('returns 409 when the request is not pending', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith({ status: 'REJECTED' }));

    const res = await acceptPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    expect(mock$transaction).not.toHaveBeenCalled();
  });

  it('accepts, decrements seats and marks the ride FULL at zero (REQ-19c)', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith());
    const tx = {
      ride: { findUnique: mockRideFindUnique, update: mockRideUpdate },
      rideRequest: { update: mockRequestUpdate }
    };
    mockTx(tx);
    mockRideFindUnique.mockResolvedValue({ ...ride, seatsAvailable: 2 });
    mockRideUpdate.mockResolvedValue({ ...ride, seatsAvailable: 0, status: 'FULL' });
    mockRequestUpdate.mockResolvedValue(requestWith({ status: 'ACCEPTED', respondedAt: '2026-08-20T00:00:00.000Z' }));

    const res = await acceptPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe('ACCEPTED');
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { seatsAvailable: 0, status: 'FULL' }
    });
    expect(mockRequestUpdate).toHaveBeenCalledWith({
      where: { id: REQUEST_ID },
      data: { status: 'ACCEPTED', respondedAt: expect.any(Date) }
    });
    expect(mockNotifyUser).toHaveBeenCalledWith(SEEKER_ID, 'ride_request_accepted', expect.anything());
  });

  it('returns 409 when the ride no longer has enough seats', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith());
    mockTx({
      ride: { findUnique: mockRideFindUnique, update: mockRideUpdate },
      rideRequest: { update: mockRequestUpdate }
    });
    mockRideFindUnique.mockResolvedValue({ ...ride, seatsAvailable: 1 });

    const res = await acceptPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('seats');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/requests/{id}/reject', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRequestFindUnique.mockReset();
    mockRequestUpdate.mockReset();
    mockNotifyUser.mockReset();
    mockGetSession.mockResolvedValue(providerSession);
  });

  it('rejects a pending request without touching seats and notifies the seeker', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith());
    const updated = requestWith({ status: 'REJECTED', respondedAt: '2026-08-20T00:00:00.000Z' });
    mockRequestUpdate.mockResolvedValue(updated);

    const res = await rejectPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe('REJECTED');
    expect(mockRideUpdate).not.toHaveBeenCalled();
    expect(mockRequestUpdate).toHaveBeenCalledWith({
      where: { id: REQUEST_ID },
      data: { status: 'REJECTED', respondedAt: expect.any(Date) }
    });
    expect(mockNotifyUser).toHaveBeenCalledWith(SEEKER_ID, 'ride_request_rejected', expect.anything());
  });

  it('returns 409 when the request is already responded to', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith({ status: 'ACCEPTED' }));

    const res = await rejectPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    expect(mockRequestUpdate).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/requests/{id}/cancel', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRequestFindUnique.mockReset();
    mockRequestUpdate.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mock$transaction.mockReset();
    mockGetSession.mockResolvedValue(seekerSession);
  });

  it('returns 404 when the request belongs to another user', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith({ seekerId: OTHER_USER_ID }));

    const res = await cancelPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(404);
  });

  it('returns 409 when the request was already rejected', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith({ status: 'REJECTED' }));

    const res = await cancelPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    expect(mockRequestUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent for an already-cancelled request', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith({ status: 'CANCELLED' }));

    const res = await cancelPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    expect(mockRequestUpdate).not.toHaveBeenCalled();
  });

  it('cancels a pending request (REQ-19e)', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith());
    const updated = requestWith({ status: 'CANCELLED' });
    mockRequestUpdate.mockResolvedValue(updated);

    const res = await cancelPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.status).toBe('CANCELLED');
    expect(mock$transaction).not.toHaveBeenCalled();
  });

  it('releases held seats and reopens a FULL ride when cancelling an accepted request (6.5)', async () => {
    mockRequestFindUnique.mockResolvedValue(requestWith({ status: 'ACCEPTED' }));
    mockTx({
      rideRequest: { update: mockRequestUpdate },
      ride: { findUnique: mockRideFindUnique, update: mockRideUpdate }
    });
    mockRequestUpdate.mockResolvedValue(requestWith({ status: 'CANCELLED' }));
    mockRideFindUnique.mockResolvedValue({ ...ride, seatsAvailable: 0, status: 'FULL' });
    mockRideUpdate.mockResolvedValue({ ...ride, seatsAvailable: 2, status: 'ACTIVE' });

    const res = await cancelPatch(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ride.status).toBe('ACTIVE');
    expect(body.ride.seatsAvailable).toBe(2);
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { seatsAvailable: 2, status: 'ACTIVE' }
    });
  });
});
