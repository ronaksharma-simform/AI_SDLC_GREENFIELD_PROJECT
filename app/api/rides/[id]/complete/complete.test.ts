import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetSession,
  mockRideFindUnique,
  mockRideUpdate,
  mockConversationUpdateMany,
  mockRequestFindMany,
  mockRequestUpdateMany,
  mock$transaction,
  mockNotifyUser
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mockRideUpdate: vi.fn(),
  mockConversationUpdateMany: vi.fn(),
  mockRequestFindMany: vi.fn(),
  mockRequestUpdateMany: vi.fn(),
  mock$transaction: vi.fn(),
  mockNotifyUser: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: {
      findUnique: mockRideFindUnique,
      update: mockRideUpdate
    },
    rideRequest: {
      findMany: mockRequestFindMany,
      updateMany: mockRequestUpdateMany
    },
    conversation: {
      updateMany: mockConversationUpdateMany
    },
    $transaction: mock$transaction
  }
}));

vi.mock('@/lib/notifications', () => ({
  notifyUser: mockNotifyUser
}));

import { POST } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const SEEKER_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const session = { user: { id: PROVIDER_ID, email: 'p@example.com', name: 'Provider', role: 'DRIVER' } };

const baseRide = {
  id: RIDE_ID,
  providerId: PROVIDER_ID,
  vehicleId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  sourceLatitude: '40.712800',
  sourceLongitude: '-74.006000',
  sourceAddress: 'Downtown',
  destinationLatitude: '40.689300',
  destinationLongitude: '-74.044500',
  destinationAddress: 'Airport',
  departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  seatsTotal: 4,
  seatsAvailable: 0,
  status: 'IN_PROGRESS',
  notes: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z'
};

function params(id = RIDE_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/rides/{id}/complete', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mockConversationUpdateMany.mockReset();
    mockConversationUpdateMany.mockResolvedValue({ count: 0 });
    mockRequestFindMany.mockReset();
    mockRequestUpdateMany.mockReset();
    mockRequestUpdateMany.mockResolvedValue({ count: 1 });
    mock$transaction.mockReset();
    mockNotifyUser.mockReset();
    mockNotifyUser.mockResolvedValue({ id: 'n1' });
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(401);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed ride id', async () => {
    const res = await POST(new Request('http://localhost'), params('nope'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when the ride does not exist or belongs to another user', async () => {
    mockRideFindUnique.mockResolvedValue(null);
    expect((await POST(new Request('http://localhost'), params())).status).toBe(404);

    mockRideFindUnique.mockResolvedValue({ ...baseRide, providerId: OTHER_USER_ID });
    expect((await POST(new Request('http://localhost'), params())).status).toBe(404);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent when the ride is already completed', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'COMPLETED' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    expect(mockRideUpdate).not.toHaveBeenCalled();
    expect(mockConversationUpdateMany).not.toHaveBeenCalled();
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it('returns 409 for a cancelled ride', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'CANCELLED' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('cancelled');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('rejects completing a ride that has not started (Section 11)', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'ACTIVE' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('started');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('completes an in-progress trip, closes conversations, and notifies accepted seekers (REQ-6 / 10.4)', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    const completed = { ...baseRide, status: 'COMPLETED', completedAt: '2026-08-24T12:00:00.000Z' };
    mockRideUpdate.mockResolvedValue(completed);
    mockRequestFindMany.mockResolvedValue([{ seekerId: SEEKER_ID }]);

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride.status).toBe('COMPLETED');
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { status: 'COMPLETED', completedAt: expect.any(Date) }
    });
    expect(mockConversationUpdateMany).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID, status: 'ACTIVE' },
      data: { status: 'CLOSED', closedAt: expect.any(Date) }
    });
    expect(mockRequestFindMany).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID, status: 'ACCEPTED' },
      select: { seekerId: true }
    });
    expect(mockNotifyUser).toHaveBeenCalledWith(SEEKER_ID, 'TripCompleted', {
      rideId: RIDE_ID,
      destinationAddress: 'Airport'
    });
  });

  it('snapshots the equal share onto every accepted request and freezes the split (PAY-4)', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, totalCost: 12000 });
    const completed = { ...baseRide, totalCost: 12000, status: 'COMPLETED' };
    mockRideUpdate.mockResolvedValue(completed);
    // First findMany call is the settlement snapshot (select: id); the second is
    // the completion notification lookup (select: seekerId).
    mockRequestFindMany
      .mockResolvedValueOnce([{ id: 'r1' }, { id: 'r2' }])
      .mockResolvedValueOnce([{ seekerId: SEEKER_ID }]);
    mock$transaction.mockImplementation((operations: unknown[]) => Promise.resolve(operations));

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    // ₹120 / (provider + 2 accepted) = 12000/3 = 4000 paise per person.
    expect(mockRequestUpdateMany).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID, status: 'ACCEPTED' },
      data: { shareAmount: 4000 }
    });
    // The ride's costFinalizedAt is set in the same atomic transaction.
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { costFinalizedAt: expect.any(Date) }
    });
    // Completion notification still fires after the settlement snapshot.
    expect(mockNotifyUser).toHaveBeenCalledWith(SEEKER_ID, 'TripCompleted', expect.anything());
  });

  it('does not snapshot a cost split when no totalCost was declared (PAY-9)', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    mockRideUpdate.mockResolvedValue({ ...baseRide, status: 'COMPLETED' });
    mockRequestFindMany.mockResolvedValue([{ seekerId: SEEKER_ID }]);

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    // The settlement path is skipped entirely; only the notify lookup runs.
    expect(mock$transaction).not.toHaveBeenCalled();
    expect(mockNotifyUser).toHaveBeenCalledTimes(1);
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    mockRideUpdate.mockRejectedValue(new Error('db down'));

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(500);
  });
});
