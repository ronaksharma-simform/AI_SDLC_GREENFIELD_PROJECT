import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories can reference them (vitest hoists the mock
// calls above imports; vi.hoisted avoids temporal-dead-zone surprises).
const { mockGetSession, mockVehicleFindFirst, mockVehicleUpdate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockVehicleFindFirst: vi.fn(),
  mockVehicleUpdate: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: {
      findFirst: mockVehicleFindFirst,
      update: mockVehicleUpdate
    }
  }
}));

import { GET, PATCH } from './route';

const ownerId = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const vehicleId = '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d';

const session = {
  user: {
    id: ownerId,
    email: 'owner@example.com',
    name: null,
    role: 'USER'
  }
};

const ownedVehicle = {
  id: vehicleId,
  ownerId,
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

const updatedVehicle = {
  ...ownedVehicle,
  model: 'Camry',
  year: 2022,
  updatedAt: '2026-08-21T00:00:00.000Z'
};

function makeRequest(body?: string, method: 'GET' | 'PATCH' = 'PATCH'): Request {
  const headers = new Headers();
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request(`http://localhost/api/vehicles/${vehicleId}`, {
    method,
    headers,
    body
  });
}

function makeContext(id = vehicleId) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/vehicles/[id] — vehicle-patch', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockVehicleFindFirst.mockReset();
    mockVehicleUpdate.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest(undefined, 'GET'), makeContext());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockVehicleFindFirst).not.toHaveBeenCalled();
  });

  it('returns 200 with the vehicle when it is owned', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);

    const res = await GET(makeRequest(undefined, 'GET'), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.vehicle).toEqual(ownedVehicle);
    expect(mockVehicleFindFirst).toHaveBeenCalledWith({
      where: { id: vehicleId, ownerId }
    });
  });

  it('returns 404 when the vehicle belongs to another user', async () => {
    mockVehicleFindFirst.mockResolvedValue(null);

    const res = await GET(makeRequest(undefined, 'GET'), makeContext());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('not found');
  });

  it('returns 404 when the id is not a valid UUID (db error is treated as not found)', async () => {
    mockVehicleFindFirst.mockRejectedValue(new Error('Inconsistent column data'));

    const res = await GET(makeRequest(undefined, 'GET'), makeContext('not-a-uuid'));

    expect(res.status).toBe(404);
    expect(mockVehicleFindFirst).toHaveBeenCalledWith({
      where: { id: 'not-a-uuid', ownerId }
    });
  });
});

describe('PATCH /api/vehicles/[id] — vehicle-patch', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockVehicleFindFirst.mockReset();
    mockVehicleUpdate.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await PATCH(makeRequest(JSON.stringify({ model: 'Camry' })), makeContext());

    expect(res.status).toBe(401);
    expect(mockVehicleUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the vehicle belongs to another user and does not update it', async () => {
    mockVehicleFindFirst.mockResolvedValue(null);

    const res = await PATCH(makeRequest(JSON.stringify({ model: 'Camry' })), makeContext());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockVehicleUpdate).not.toHaveBeenCalled();
  });

  it('updates an owned vehicle and returns the updated vehicle', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);
    mockVehicleUpdate.mockResolvedValue(updatedVehicle);

    const res = await PATCH(
      makeRequest(JSON.stringify({ model: 'Camry', year: 2022 })),
      makeContext()
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.vehicle).toEqual(updatedVehicle);
    expect(mockVehicleUpdate).toHaveBeenCalledWith({
      where: { id: vehicleId },
      data: { model: 'Camry', year: 2022 }
    });
  });

  it('returns 400 when a provided field is invalid', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);

    const res = await PATCH(
      makeRequest(JSON.stringify({ seatCapacity: 99 })),
      makeContext()
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.seatCapacity[0]).toContain('at most 8');
    expect(mockVehicleUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);

    const res = await PATCH(makeRequest('{not json'), makeContext());

    expect(res.status).toBe(400);
    expect(mockVehicleUpdate).not.toHaveBeenCalled();
  });

  it('returns 409 when the license plate is already registered', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);
    mockVehicleUpdate.mockRejectedValue(Object.assign(new Error('unique constraint'), { code: 'P2002' }));

    const res = await PATCH(makeRequest(JSON.stringify({ licensePlate: 'EXISTING' })), makeContext());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('already exists');
  });

  it('returns 500 for an unexpected database error', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);
    mockVehicleUpdate.mockRejectedValue(new Error('db down'));

    const res = await PATCH(makeRequest(JSON.stringify({ model: 'Camry' })), makeContext());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
