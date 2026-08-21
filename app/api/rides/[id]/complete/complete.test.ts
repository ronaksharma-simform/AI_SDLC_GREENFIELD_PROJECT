import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockRideFindUnique, mockRideUpdate, mockConversationUpdateMany } = vi.hoisted(
  () => ({
    mockGetSession: vi.fn(),
    mockRideFindUnique: vi.fn(),
    mockRideUpdate: vi.fn(),
    mockConversationUpdateMany: vi.fn()
  })
);

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: {
      findUnique: mockRideFindUnique,
      update: mockRideUpdate
    },
    conversation: {
      updateMany: mockConversationUpdateMany
    }
  }
}));

import { POST } from './route';

const PROVIDER_ID = 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f';
const OTHER_USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
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
  status: 'ACTIVE',
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
  });

  it('returns 409 for a cancelled ride', async () => {
    mockRideFindUnique.mockResolvedValue({ ...baseRide, status: 'CANCELLED' });

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('cancelled');
    expect(mockRideUpdate).not.toHaveBeenCalled();
  });

  it('completes the ride and closes its conversations (REQ-6)', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    const completed = { ...baseRide, status: 'COMPLETED' };
    mockRideUpdate.mockResolvedValue(completed);

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ride.status).toBe('COMPLETED');
    expect(mockRideUpdate).toHaveBeenCalledWith({
      where: { id: RIDE_ID },
      data: { status: 'COMPLETED' }
    });
    expect(mockConversationUpdateMany).toHaveBeenCalledWith({
      where: { rideId: RIDE_ID, status: 'ACTIVE' },
      data: { status: 'CLOSED', closedAt: expect.any(Date) }
    });
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindUnique.mockResolvedValue(baseRide);
    mockRideUpdate.mockRejectedValue(new Error('db down'));

    const res = await POST(new Request('http://localhost'), params());

    expect(res.status).toBe(500);
  });
});
