import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories can reference them (vitest hoists the mock
// calls above imports; vi.hoisted avoids temporal-dead-zone surprises).
const { mockGetSession, mockVehicleCreate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockVehicleCreate: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: {
      create: mockVehicleCreate
    }
  }
}));

import { POST } from './route';

const session = {
  user: {
    id: 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f',
    email: 'owner@example.com',
    name: null,
    role: 'USER'
  }
};

const createdVehicle = {
  id: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
  ownerId: session.user.id,
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

function makeRequest(body?: string): Request {
  const headers = new Headers();
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request('http://localhost/api/vehicles', {
    method: 'POST',
    headers,
    body
  });
}

const validBody = {
  make: 'Toyota',
  model: 'Corolla',
  year: 2021,
  color: 'Red',
  licensePlate: 'ABC123',
  seatCapacity: 4,
  vehicleType: 'SEDAN'
};

describe('POST /api/vehicles', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockVehicleCreate.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockVehicleCreate).not.toHaveBeenCalled();
  });

  it('returns 201 and creates the vehicle owned by the session user', async () => {
    mockVehicleCreate.mockResolvedValue(createdVehicle);

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.vehicle).toEqual(createdVehicle);

    // Ownership always comes from the session, never from the request body.
    expect(mockVehicleCreate).toHaveBeenCalledWith({
      data: {
        ownerId: session.user.id,
        make: 'Toyota',
        model: 'Corolla',
        year: 2021,
        color: 'Red',
        licensePlate: 'ABC123',
        seatCapacity: 4,
        vehicleType: 'SEDAN'
      }
    });
  });

  it('stores null color when color is omitted', async () => {
    mockVehicleCreate.mockResolvedValue({ ...createdVehicle, color: null });

    const { color: _omitted, ...bodyWithoutColor } = validBody;
    await POST(makeRequest(JSON.stringify(bodyWithoutColor)));

    expect(mockVehicleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ color: null })
    });
  });

  it('returns 400 when seat capacity is below 1', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...validBody, seatCapacity: 0 })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.seatCapacity[0]).toContain('at least 1');
    expect(mockVehicleCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when seat capacity is above 8', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...validBody, seatCapacity: 9 })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.seatCapacity[0]).toContain('at most 8');
    expect(mockVehicleCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest(JSON.stringify({ make: 'Toyota' })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details).toHaveProperty('model');
    expect(body.details).toHaveProperty('licensePlate');
    expect(mockVehicleCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid vehicle type', async () => {
    const res = await POST(makeRequest(JSON.stringify({ ...validBody, vehicleType: 'JET' })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.vehicleType[0]).toContain("Invalid enum value");
    expect(mockVehicleCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeRequest('{not json'));

    expect(res.status).toBe(400);
    expect(mockVehicleCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when the license plate is already registered', async () => {
    mockVehicleCreate.mockRejectedValue(Object.assign(new Error('unique constraint'), { code: 'P2002' }));

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('already exists');
  });

  it('returns 500 for an unexpected database error', async () => {
    mockVehicleCreate.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest(JSON.stringify(validBody)));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
