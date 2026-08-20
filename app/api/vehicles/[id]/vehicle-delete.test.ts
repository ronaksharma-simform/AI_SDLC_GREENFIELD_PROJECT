import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories can reference them (vitest hoists the mock
// calls above imports; vi.hoisted avoids temporal-dead-zone surprises).
const { mockGetSession, mockVehicleFindFirst, mockVehicleDelete } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockVehicleFindFirst: vi.fn(),
  mockVehicleDelete: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vehicle: {
      findFirst: mockVehicleFindFirst,
      delete: mockVehicleDelete
    }
  }
}));

import { DELETE } from './route';

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

function makeRequest(): Request {
  return new Request(`http://localhost/api/vehicles/${vehicleId}`, {
    method: 'DELETE'
  });
}

function makeContext(id = vehicleId) {
  return { params: Promise.resolve({ id }) };
}

describe('DELETE /api/vehicles/[id] — vehicle-delete', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockVehicleFindFirst.mockReset();
    mockVehicleDelete.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), makeContext());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockVehicleFindFirst).not.toHaveBeenCalled();
    expect(mockVehicleDelete).not.toHaveBeenCalled();
  });

  it('deletes an owned vehicle and returns the deleted vehicle', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);
    mockVehicleDelete.mockResolvedValue(ownedVehicle);

    const res = await DELETE(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.vehicle).toEqual(ownedVehicle);
    expect(mockVehicleFindFirst).toHaveBeenCalledWith({
      where: { id: vehicleId, ownerId }
    });
    expect(mockVehicleDelete).toHaveBeenCalledWith({
      where: { id: vehicleId }
    });
  });

  it('returns 404 when the vehicle belongs to another user and does not delete it', async () => {
    mockVehicleFindFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest(), makeContext());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('not found');
    expect(mockVehicleDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the id is not a valid UUID (db error is treated as not found)', async () => {
    mockVehicleFindFirst.mockRejectedValue(new Error('Inconsistent column data'));

    const res = await DELETE(makeRequest(), makeContext('not-a-uuid'));

    expect(res.status).toBe(404);
    expect(mockVehicleDelete).not.toHaveBeenCalled();
  });

  it('returns 404 when the vehicle disappears between the ownership check and delete (P2025)', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);
    mockVehicleDelete.mockRejectedValue(
      Object.assign(new Error('Record to delete does not exist.'), { code: 'P2025' })
    );

    const res = await DELETE(makeRequest(), makeContext());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 500 for an unexpected database error', async () => {
    mockVehicleFindFirst.mockResolvedValue(ownedVehicle);
    mockVehicleDelete.mockRejectedValue(new Error('db down'));

    const res = await DELETE(makeRequest(), makeContext());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
