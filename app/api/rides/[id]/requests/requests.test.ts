import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetSession,
  mockRideFindUnique,
  mockRequestFindFirst,
  mockRequestCreate,
  mockRequestFindMany,
  mockNotifyUser
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mockRequestFindFirst: vi.fn(),
  mockRequestCreate: vi.fn(),
  mockRequestFindMany: vi.fn(),
  mockNotifyUser: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: {
      findUnique: mockRideFindUnique
    },
    rideRequest: {
      findFirst: mockRequestFindFirst,
      create: mockRequestCreate,
      findMany: mockRequestFindMany
    }
  }
}));

vi.mock('@/lib/notifications', () => ({
  notifyUser: mockNotifyUser
}));

import { GET, POST } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const session = { user: { id: SEEKER_ID, email: 'seeker@example.com', name: null, role: 'USER' } };

const activeRide = {
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

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body?: string, method = 'POST'): Request {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request(`http://localhost/api/rides/${RIDE_ID}/requests`, { method, headers, body });
}

describe('POST /api/rides/{id}/requests', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRequestFindFirst.mockReset();
    mockRequestCreate.mockReset();
    mockNotifyUser.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makeRequest(JSON.stringify({ seatsRequested: 1 })), params(RIDE_ID));

    expect(res.status).toBe(401);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed ride id', async () => {
    const res = await POST(makeRequest(JSON.stringify({ seatsRequested: 1 })), params('nope'));

    expect(res.status).toBe(400);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeRequest('{bad'), params(RIDE_ID));

    expect(res.status).toBe(400);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when seatsRequested is below 1', async () => {
    const res = await POST(makeRequest(JSON.stringify({ seatsRequested: 0 })), params(RIDE_ID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.seatsRequested[0]).toContain('at least 1');
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('returns 404 when the ride does not exist', async () => {
    mockRideFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(JSON.stringify({ seatsRequested: 1 })), params(RIDE_ID));

    expect(res.status).toBe(404);
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the ride is not ACTIVE', async () => {
    mockRideFindUnique.mockResolvedValue({ ...activeRide, status: 'FULL' });

    const res = await POST(makeRequest(JSON.stringify({ seatsRequested: 1 })), params(RIDE_ID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no longer accepting');
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when seatsRequested exceeds availability (REQ-19a)', async () => {
    mockRideFindUnique.mockResolvedValue({ ...activeRide, seatsAvailable: 2 });

    const res = await POST(makeRequest(JSON.stringify({ seatsRequested: 3 })), params(RIDE_ID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('seat');
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the seeker already has an active request (REQ-19b)', async () => {
    mockRideFindUnique.mockResolvedValue(activeRide);
    mockRequestFindFirst.mockResolvedValue({ id: 'existing', status: 'PENDING' });

    const res = await POST(makeRequest(JSON.stringify({ seatsRequested: 1 })), params(RIDE_ID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('active request');
    expect(mockRequestCreate).not.toHaveBeenCalled();
  });

  it('creates a PENDING request and notifies the provider (REQ-15 / REQ-16)', async () => {
    mockRideFindUnique.mockResolvedValue(activeRide);
    mockRequestFindFirst.mockResolvedValue(null);
    const created = {
      id: 'c0ffee00-0000-4000-8000-000000000000',
      rideId: RIDE_ID,
      seekerId: SEEKER_ID,
      seatsRequested: 2,
      status: 'PENDING',
      message: 'I have a small bag',
      createdAt: '2026-08-20T00:00:00.000Z',
      respondedAt: null
    };
    mockRequestCreate.mockResolvedValue(created);

    const res = await POST(
      makeRequest(JSON.stringify({ seatsRequested: 2, message: 'I have a small bag' })),
      params(RIDE_ID)
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.request).toEqual(created);

    expect(mockRequestCreate).toHaveBeenCalledWith({
      data: {
        rideId: RIDE_ID,
        seekerId: SEEKER_ID,
        seatsRequested: 2,
        status: 'PENDING',
        message: 'I have a small bag'
      }
    });
    expect(mockNotifyUser).toHaveBeenCalledWith(PROVIDER_ID, 'ride_request_received', expect.anything());
  });
});

describe('GET /api/rides/{id}/requests', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRequestFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest(undefined, 'GET'), params(RIDE_ID));

    expect(res.status).toBe(401);
  });

  it('returns 404 for a ride owned by another user (no existence confirmation)', async () => {
    mockRideFindUnique.mockResolvedValue({ id: RIDE_ID, providerId: PROVIDER_ID });

    const res = await GET(makeRequest(undefined, 'GET'), params(RIDE_ID));

    expect(res.status).toBe(404);
    expect(mockRequestFindMany).not.toHaveBeenCalled();
  });

  it('lists requests for a ride the caller owns', async () => {
    mockRideFindUnique.mockResolvedValue({ id: RIDE_ID, providerId: SEEKER_ID });
    const requests = [{ id: 'r1', rideId: RIDE_ID, status: 'PENDING' }];
    mockRequestFindMany.mockResolvedValue(requests);

    const res = await GET(makeRequest(undefined, 'GET'), params(RIDE_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests).toEqual(requests);
    expect(mockRequestFindMany).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID },
      include: { seeker: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' }
    });
  });
});
