import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetSession,
  mockRideFindUnique,
  mockRideUpdate,
  mockSnapshotFindFirst,
  mockSnapshotCreate,
  mockRequestFindFirst
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mockRideUpdate: vi.fn(),
  mockSnapshotFindFirst: vi.fn(),
  mockSnapshotCreate: vi.fn(),
  mockRequestFindFirst: vi.fn()
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
    rideLocationSnapshot: {
      findFirst: mockSnapshotFindFirst,
      create: mockSnapshotCreate
    },
    rideRequest: {
      findFirst: mockRequestFindFirst
    }
  }
}));

import { POST, GET } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_USER_ID = 'cccccccc-dddd-4eee-8fff-000000000000';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const providerSession = { user: { id: PROVIDER_ID, email: 'p@example.com', name: null, role: 'DRIVER' } };
const seekerSession = { user: { id: SEEKER_ID, email: 's@example.com', name: null, role: 'USER' } };

const inProgressRide = {
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
  startedAt: new Date(),
  completedAt: null,
  currentLatitude: '40.712900',
  currentLongitude: '-74.006100',
  locationUpdatedAt: new Date(Date.now() - 60_000),
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z'
};

function params(id = RIDE_ID) {
  return { params: Promise.resolve({ id }) };
}

function postRequest(body: string): Request {
  return new Request(`http://localhost/api/rides/${RIDE_ID}/location`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body
  });
}

function getRequest(): Request {
  return new Request(`http://localhost/api/rides/${RIDE_ID}/location`, { method: 'GET' });
}

describe('POST /api/rides/{id}/location', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mockSnapshotFindFirst.mockReset();
    mockSnapshotCreate.mockReset();
    mockGetSession.mockResolvedValue(providerSession);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(postRequest(JSON.stringify({ latitude: 40.71, longitude: -74.0 })), params());

    expect(res.status).toBe(401);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed ride id', async () => {
    const res = await POST(
      postRequest(JSON.stringify({ latitude: 40.71, longitude: -74.0 })),
      params('nope')
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(postRequest('{bad'), params());

    expect(res.status).toBe(400);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when coordinates are out of range (Section 11)', async () => {
    mockRideFindUnique.mockResolvedValue(inProgressRide);

    const res = await POST(postRequest(JSON.stringify({ latitude: 91, longitude: -74 })), params());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.latitude[0]).toContain('between -90 and 90');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the ride does not exist or belongs to another user', async () => {
    mockRideFindUnique.mockResolvedValue(null);
    expect(
      (await POST(postRequest(JSON.stringify({ latitude: 40.71, longitude: -74.0 })), params())).status
    ).toBe(404);

    mockRideFindUnique.mockResolvedValue({ ...inProgressRide, providerId: OTHER_USER_ID });
    expect(
      (await POST(postRequest(JSON.stringify({ latitude: 40.71, longitude: -74.0 })), params())).status
    ).toBe(404);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 when the ride is not In Progress (REQ-7)', async () => {
    mockRideFindUnique.mockResolvedValue({ ...inProgressRide, status: 'COMPLETED' });

    const res = await POST(postRequest(JSON.stringify({ latitude: 40.71, longitude: -74.0 })), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('in progress');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 429 when updates arrive faster than the rate limit (Section 12)', async () => {
    mockRideFindUnique.mockResolvedValue({
      ...inProgressRide,
      locationUpdatedAt: new Date(Date.now() - 500)
    });

    const res = await POST(postRequest(JSON.stringify({ latitude: 40.71, longitude: -74.0 })), params());

    expect(res.status).toBe(429);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('overwrites the current location fields and writes a snapshot when due (REQ-3 / 10.2)', async () => {
    mockRideFindUnique.mockResolvedValue(inProgressRide);
    const updated = { ...inProgressRide, currentLatitude: '40.715000', currentLongitude: '-74.010000' };
    mockRideUpdate.mockResolvedValue(updated);
    mockSnapshotFindFirst.mockResolvedValue(null);

    const res = await POST(postRequest(JSON.stringify({ latitude: 40.715, longitude: -74.01 })), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride.currentLatitude).toBe(40.715);
    expect(body.ride.currentLongitude).toBe(-74.01);

    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: {
        currentLatitude: 40.715,
        currentLongitude: -74.01,
        locationUpdatedAt: expect.any(Date)
      }
    });
    expect(mockSnapshotFindFirst).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID },
      orderBy: { recordedAt: 'desc' },
      select: { recordedAt: true }
    });
    expect(mockSnapshotCreate).toHaveBeenCalledWith({
      data: {
        rideId: RIDE_ID,
        latitude: 40.715,
        longitude: -74.01,
        recordedAt: expect.any(Date)
      }
    });
  });

  it('skips the history snapshot when one was written recently (10.2)', async () => {
    mockRideFindUnique.mockResolvedValue(inProgressRide);
    mockRideUpdate.mockResolvedValue(inProgressRide);
    mockSnapshotFindFirst.mockResolvedValue({ recordedAt: new Date(Date.now() - 5_000) });

    const res = await POST(postRequest(JSON.stringify({ latitude: 40.715, longitude: -74.01 })), params());

    expect(res.status).toBe(200);
    expect(mockSnapshotCreate).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindUnique.mockResolvedValue(inProgressRide);
    mockRideUpdate.mockRejectedValue(new Error('db down'));

    const res = await POST(postRequest(JSON.stringify({ latitude: 40.715, longitude: -74.01 })), params());

    expect(res.status).toBe(500);
  });
});

describe('GET /api/rides/{id}/location', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRequestFindFirst.mockReset();
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(getRequest(), params());

    expect(res.status).toBe(401);
  });

  it('returns 400 for a malformed ride id', async () => {
    mockGetSession.mockResolvedValue(seekerSession);
    const res = await GET(getRequest(), params('nope'));

    expect(res.status).toBe(400);
  });

  it('returns 404 when the ride does not exist', async () => {
    mockGetSession.mockResolvedValue(seekerSession);
    mockRideFindUnique.mockResolvedValue(null);

    const res = await GET(getRequest(), params());

    expect(res.status).toBe(404);
  });

  it('returns 403 for a user who is not the provider nor an Accepted Seeker (REQ-8)', async () => {
    mockGetSession.mockResolvedValue(seekerSession);
    mockRideFindUnique.mockResolvedValue(inProgressRide);
    mockRequestFindFirst.mockResolvedValue(null);

    const res = await GET(getRequest(), params());

    expect(res.status).toBe(403);
  });

  it('returns the live location to the ride Provider', async () => {
    mockGetSession.mockResolvedValue(providerSession);
    mockRideFindUnique.mockResolvedValue(inProgressRide);

    const res = await GET(getRequest(), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride.currentLatitude).toBe(40.7129);
    expect(body.ride.destinationAddress).toBeUndefined();
    expect(mockRequestFindFirst).not.toHaveBeenCalled();
  });

  it('returns the live location to an Accepted Seeker', async () => {
    mockGetSession.mockResolvedValue(seekerSession);
    mockRideFindUnique.mockResolvedValue(inProgressRide);
    mockRequestFindFirst.mockResolvedValue({ id: 'req-1' });

    const res = await GET(getRequest(), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockRequestFindFirst).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID, seekerId: SEEKER_ID, status: 'ACCEPTED' },
      select: { id: true }
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockGetSession.mockResolvedValue(providerSession);
    mockRideFindUnique.mockRejectedValue(new Error('db down'));

    const res = await GET(getRequest(), params());

    expect(res.status).toBe(500);
  });
});
