import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories can reference them (vitest hoists the mock
// calls above imports; vi.hoisted avoids temporal-dead-zone surprises).
const { mockGetSession, mockVehicleFindUnique, mockRideCreate, mockRideFindMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockVehicleFindUnique: vi.fn(),
  mockRideCreate: vi.fn(),
  mockRideFindMany: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: {
      findUnique: mockVehicleFindUnique
    },
    ride: {
      create: mockRideCreate,
      findMany: mockRideFindMany
    }
  }
}));

import { GET, POST } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const session = {
  user: {
    id: PROVIDER_ID,
    email: 'provider@example.com',
    name: null,
    role: 'USER'
  }
};

const vehicle = {
  id: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  ownerId: PROVIDER_ID,
  make: 'Toyota',
  model: 'Corolla',
  year: 2021,
  color: 'Red',
  licensePlate: 'ABC123',
  seatCapacity: 4,
  vehicleType: 'SEDAN',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z'
};

const FUTURE_ISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const sourceLocation = { latitude: 40.7128, longitude: -74.006, address: 'Downtown', placeId: 's-1' };
const destinationLocation = { latitude: 40.6893, longitude: -74.0445, address: 'Airport', placeId: 'd-1' };

const createdRide = {
  id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  providerId: PROVIDER_ID,
  vehicleId: vehicle.id,
  sourceLatitude: '40.712800',
  sourceLongitude: '-74.006000',
  sourceAddress: 'Downtown',
  destinationLatitude: '40.689300',
  destinationLongitude: '-74.044500',
  destinationAddress: 'Airport',
  departureTime: FUTURE_ISO,
  seatsTotal: 3,
  seatsAvailable: 3,
  status: 'ACTIVE',
  notes: null,
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  vehicle
};

function makeRequest(body?: string, method = 'POST'): Request {
  const headers = new Headers();
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request('http://localhost/api/rides', {
    method,
    headers,
    body
  });
}

const validBody = {
  vehicleId: vehicle.id,
  source: sourceLocation,
  destination: destinationLocation,
  departureTime: FUTURE_ISO,
  seatsTotal: 3
};

describe('POST /api/rides', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockVehicleFindUnique.mockReset();
    mockRideCreate.mockReset();
    mockRideFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 201 and creates a ride owned by the session user', async () => {
    mockVehicleFindUnique.mockResolvedValue(vehicle);
    mockRideCreate.mockResolvedValue(createdRide);

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride).toEqual(createdRide);

    // providerId always comes from the session; seatsAvailable starts equal to
    // seatsTotal; status starts ACTIVE; the vehicle is included in the response.
    // Coordinates + address are persisted for both source and destination.
    expect(mockRideCreate).toHaveBeenCalledWith({
      data: {
        providerId: PROVIDER_ID,
        vehicleId: vehicle.id,
        sourceLatitude: 40.7128,
        sourceLongitude: -74.006,
        sourceAddress: 'Downtown',
        destinationLatitude: 40.6893,
        destinationLongitude: -74.0445,
        destinationAddress: 'Airport',
        departureTime: new Date(FUTURE_ISO),
        seatsTotal: 3,
        seatsAvailable: 3,
        status: 'ACTIVE',
        notes: null
      },
      include: { vehicle: true }
    });
  });

  it('stores null notes when notes are omitted', async () => {
    mockVehicleFindUnique.mockResolvedValue(vehicle);
    mockRideCreate.mockResolvedValue(createdRide);

    await POST(makeRequest(JSON.stringify(validBody)));

    expect(mockRideCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ notes: null }),
      include: { vehicle: true }
    });
  });

  it('returns 400 when departure time is in the past', async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({ ...validBody, departureTime: new Date(Date.now() - 1000).toISOString() })
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.departureTime[0]).toContain('future');
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when seatsTotal is below 1', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...validBody, seatsTotal: 0 })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.seatsTotal[0]).toContain('at least 1');
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest(JSON.stringify({ vehicleId: vehicle.id })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details).toHaveProperty('source');
    expect(body.details).toHaveProperty('destination');
    expect(body.details).toHaveProperty('departureTime');
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the source address is shorter than 2 characters', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ ...validBody, source: { ...sourceLocation, address: 'X' } }))
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.source.some((message: string) => message.includes('at least 2'))).toBe(true);
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the source latitude is out of range', async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({ ...validBody, source: { ...sourceLocation, latitude: 100 } })
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.source.some((message: string) => message.includes('-90'))).toBe(true);
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when source and destination resolve to the same point', async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({ ...validBody, destination: { ...sourceLocation, address: 'Also Downtown' } })
      )
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('different locations');
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeRequest('{not json'));

    expect(res.status).toBe(400);
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the selected vehicle does not exist', async () => {
    mockVehicleFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('vehicle');
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when the vehicle belongs to another user', async () => {
    mockVehicleFindUnique.mockResolvedValue({ ...vehicle, ownerId: OTHER_USER_ID });

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('own');
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when seatsTotal exceeds the vehicle seat capacity', async () => {
    mockVehicleFindUnique.mockResolvedValue(vehicle);

    const res = await POST(makeRequest(JSON.stringify({ ...validBody, seatsTotal: 5 })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('capacity');
    expect(mockRideCreate).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected database error', async () => {
    mockVehicleFindUnique.mockResolvedValue(vehicle);
    mockRideCreate.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});

describe('GET /api/rides', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest(undefined, 'GET'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockRideFindMany).not.toHaveBeenCalled();
  });

  it('returns only the current user\u2019s rides, ordered by upcoming departure', async () => {
    mockRideFindMany.mockResolvedValue([createdRide]);

    const res = await GET(makeRequest(undefined, 'GET'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.rides).toEqual([createdRide]);

    expect(mockRideFindMany).toHaveBeenCalledWith({
      where: { providerId: PROVIDER_ID },
      include: { vehicle: true },
      orderBy: { departureTime: 'asc' }
    });
  });
});
