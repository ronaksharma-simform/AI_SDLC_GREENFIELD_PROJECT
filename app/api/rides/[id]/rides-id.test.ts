import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories can reference them.
const { mockGetSession, mockRideFindUnique, mockRideUpdate, mockVehicleFindUnique } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindUnique: vi.fn(),
  mockRideUpdate: vi.fn(),
  mockVehicleFindUnique: vi.fn()
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
    vehicle: {
      findUnique: mockVehicleFindUnique
    }
  }
}));

import { GET, PATCH, DELETE } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RIDE_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

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

const baseRide = {
  id: RIDE_ID,
  providerId: PROVIDER_ID,
  vehicleId: vehicle.id,
  source: 'Downtown',
  destination: 'Airport',
  departureTime: FUTURE_ISO,
  seatsTotal: 4,
  seatsAvailable: 4,
  status: 'ACTIVE',
  notes: 'Meet at main entrance',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  vehicle
};

/** An unlocked ride: no seats accepted yet. */
const currentRide = { ...baseRide };

/** A locked ride: two of four seats already accepted. */
const lockedRide = { ...baseRide, seatsAvailable: 2 };

const newVehicle = { ...vehicle, id: '22222222-3333-4444-aaaa-bbbbbbbbbbbb', seatCapacity: 6 };

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(body?: string, method = 'GET'): Request {
  const headers = new Headers();
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request(`http://localhost/api/rides/${RIDE_ID}`, {
    method,
    headers,
    body
  });
}

describe('GET /api/rides/{id}', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(401);
    expect(mockRideFindUnique).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed ride id', async () => {
    const res = await GET(makeRequest(), params('not-a-uuid'));

    expect(res.status).toBe(400);
    expect(mockRideFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the ride does not exist', async () => {
    mockRideFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('returns 404 (not 403) for a ride owned by another user', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, providerId: OTHER_USER_ID });

    const res = await GET(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });

  it('returns the ride for its owner', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);

    const res = await GET(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride).toEqual(currentRide);
  });
});

describe('PATCH /api/rides/{id}', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mockVehicleFindUnique.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PATCH(makeRequest(JSON.stringify({ notes: 'hi' }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(401);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed ride id', async () => {
    const res = await PATCH(makeRequest(JSON.stringify({ notes: 'hi' }), 'PATCH'), params('nope'));

    expect(res.status).toBe(400);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the ride does not exist', async () => {
    mockRideFindUnique.mockResolvedValue(null);

    const res = await PATCH(makeRequest(JSON.stringify({ notes: 'hi' }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(404);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a ride owned by another user', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, providerId: OTHER_USER_ID });

    const res = await PATCH(makeRequest(JSON.stringify({ notes: 'hi' }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(404);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);

    const res = await PATCH(makeRequest('{bad', 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(400);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when a field fails validation', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);

    const res = await PATCH(makeRequest(JSON.stringify({ source: 'X' }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.source[0]).toContain('at least 2');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('updates only notes when the ride is locked (core fields locked, REQ-9)', async () => {
    mockRideFindUnique.mockResolvedValue(lockedRide);
    const updated = { ...lockedRide, notes: 'Updated note' };
    mockRideUpdate.mockResolvedValue(updated);

    const res = await PATCH(makeRequest(JSON.stringify({ notes: 'Updated note' }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ride).toEqual(updated);
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { notes: 'Updated note' },
      include: { vehicle: true }
    });
  });

  it('allows non-core fields (source/destination) when locked', async () => {
    mockRideFindUnique.mockResolvedValue(lockedRide);
    mockRideUpdate.mockResolvedValue({ ...lockedRide, source: 'Uptown' });

    const res = await PATCH(makeRequest(JSON.stringify({ source: 'Uptown' }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(200);
    expect(mockRideUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: 'Uptown' }) })
    );
  });

  it('rejects a departure time change when the ride is locked', async () => {
    mockRideFindUnique.mockResolvedValue(lockedRide);

    const res = await PATCH(
      makeRequest(JSON.stringify({ departureTime: FUTURE_ISO }), 'PATCH'),
      params(RIDE_ID)
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('locked');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('rejects a vehicle change when the ride is locked', async () => {
    mockRideFindUnique.mockResolvedValue(lockedRide);

    const res = await PATCH(makeRequest(JSON.stringify({ vehicleId: newVehicle.id }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(409);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('rejects a seat count change when the ride is locked', async () => {
    mockRideFindUnique.mockResolvedValue(lockedRide);

    const res = await PATCH(makeRequest(JSON.stringify({ seatsTotal: 3 }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(409);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('rejects a vehicle that belongs to another user', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);
    mockVehicleFindUnique.mockResolvedValue({ ...newVehicle, ownerId: OTHER_USER_ID });

    const res = await PATCH(
      makeRequest(JSON.stringify({ vehicleId: newVehicle.id }), 'PATCH'),
      params(RIDE_ID)
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('own');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('rejects a seat count that exceeds the vehicle capacity', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);

    const res = await PATCH(makeRequest(JSON.stringify({ seatsTotal: 9 }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('capacity');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('applies a full edit (vehicle + seats + fields) when unlocked', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);
    mockVehicleFindUnique.mockResolvedValue(newVehicle);
    const updated = { ...currentRide, vehicleId: newVehicle.id, source: 'Uptown', seatsTotal: 5, seatsAvailable: 5, notes: null };
    mockRideUpdate.mockResolvedValue(updated);

    const res = await PATCH(
      makeRequest(
        JSON.stringify({ vehicleId: newVehicle.id, source: 'Uptown', seatsTotal: 5 }),
        'PATCH'
      ),
      params(RIDE_ID)
    );

    expect(res.status).toBe(200);
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: {
        vehicleId: newVehicle.id,
        source: 'Uptown',
        seatsTotal: 5,
        seatsAvailable: 5
      },
      include: { vehicle: true }
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);
    mockRideUpdate.mockRejectedValue(new Error('db down'));

    const res = await PATCH(makeRequest(JSON.stringify({ notes: 'hi' }), 'PATCH'), params(RIDE_ID));

    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/rides/{id}', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindUnique.mockReset();
    mockRideUpdate.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(401);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed ride id', async () => {
    const res = await DELETE(makeRequest(), params('nope'));

    expect(res.status).toBe(400);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the ride does not exist', async () => {
    mockRideFindUnique.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(404);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a ride owned by another user', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, providerId: OTHER_USER_ID });

    const res = await DELETE(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(404);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('soft-cancels the ride (sets status to CANCELLED)', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);
    const cancelled = { ...currentRide, status: 'CANCELLED' };
    mockRideUpdate.mockResolvedValue(cancelled);

    const res = await DELETE(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride.status).toBe('CANCELLED');
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { status: 'CANCELLED' }
    });
  });

  it('is idempotent when the ride is already cancelled', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'CANCELLED' });

    const res = await DELETE(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(200);
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 for a completed ride', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'COMPLETED' });

    const res = await DELETE(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('completed');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindUnique.mockResolvedValue(currentRide);
    mockRideUpdate.mockRejectedValue(new Error('db down'));

    const res = await DELETE(makeRequest(), params(RIDE_ID));

    expect(res.status).toBe(500);
  });
});
