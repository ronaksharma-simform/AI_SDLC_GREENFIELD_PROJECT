import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetSession,
  mockRideFindUnique,
  mockRideUpdate,
  mockRequestFindMany,
  mockNotifyUser
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mockRideUpdate: vi.fn(),
  mockRequestFindMany: vi.fn(),
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
      findMany: mockRequestFindMany
    }
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

const session = { user: { id: PROVIDER_ID, email: 'p@example.com', name: null, role: 'DRIVER' } };

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
  status: 'FULL',
  notes: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z'
};

function params(id = RIDE_ID) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/rides/{id}/start', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mockRequestFindMany.mockReset();
    mockNotifyUser.mockReset();
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

  it('returns 409 for an already-started trip', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'IN_PROGRESS' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already started');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 for a completed ride', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'COMPLETED' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 for a cancelled ride', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'CANCELLED' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('starts the trip from a Full ride, recording startedAt (REQ-1 / REQ-2)', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    const started = { ...baseRide, status: 'IN_PROGRESS', startedAt: '2026-08-24T12:00:00.000Z' };
    mockRideUpdate.mockResolvedValue(started);
    mockRequestFindMany.mockResolvedValue([{ seekerId: SEEKER_ID }]);
    mockNotifyUser.mockResolvedValue({ id: 'n1' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride.status).toBe('IN_PROGRESS');

    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { status: 'IN_PROGRESS', startedAt: expect.any(Date) }
    });
    expect(mockRequestFindMany).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID, status: 'ACCEPTED' },
      select: { seekerId: true }
    });
    expect(mockNotifyUser).toHaveBeenCalledWith(SEEKER_ID, 'TripStarted', {
      rideId: RIDE_ID,
      destinationAddress: 'Airport'
    });
  });

  it('allows starting an Active ride departing without a full car (REQ-1)', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'ACTIVE' });
    mockRideUpdate.mockResolvedValue({ ...baseRide, status: 'IN_PROGRESS' });
    mockRequestFindMany.mockResolvedValue([]);

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { status: 'IN_PROGRESS', startedAt: expect.any(Date) }
    });
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    mockRideUpdate.mockRejectedValue(new Error('db down'));

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(500);
  });
});
