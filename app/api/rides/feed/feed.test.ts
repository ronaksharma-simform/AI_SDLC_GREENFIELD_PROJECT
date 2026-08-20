import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockRideFindMany } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRideFindMany: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ride: {
      findMany: mockRideFindMany
    }
  }
}));

import { GET } from './route';

const SEEKER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OTHER_PROVIDER_ID = '11111111-2222-4333-8444-555555555555';
const OWN_PROVIDER_ID = '66666666-7777-4888-8999-aaaaaaaaaaaa';

const session = { user: { id: SEEKER_ID, email: 'seeker@example.com', name: null, role: 'USER' } };

const FUTURE_ISO = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

function ride(overrides: Record<string, unknown> = {}) {
  return {
    id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
    providerId: OTHER_PROVIDER_ID,
    vehicleId: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
    sourceLatitude: '40.712800',
    sourceLongitude: '-74.006000',
    sourceAddress: 'Downtown',
    destinationLatitude: '40.689300',
    destinationLongitude: '-74.044500',
    destinationAddress: 'Airport',
    departureTime: FUTURE_ISO,
    seatsTotal: 4,
    seatsAvailable: 3,
    status: 'ACTIVE',
    notes: null,
    createdAt: '2026-08-20T00:00:00.000Z',
    updatedAt: '2026-08-20T00:00:00.000Z',
    vehicle: {
      id: '7a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d',
      make: 'Toyota',
      model: 'Corolla',
      year: 2021,
      seatCapacity: 4,
      vehicleType: 'SEDAN'
    },
    provider: { id: OTHER_PROVIDER_ID, name: 'Rider Provider', email: 'provider@example.com' },
    ...overrides
  };
}

function makeRequest(url = 'http://localhost/api/rides/feed'): Request {
  return new Request(url);
}

describe('GET /api/rides/feed', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRideFindMany.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    expect(mockRideFindMany).not.toHaveBeenCalled();
  });

  it('returns open rides and always excludes the caller\u2019s own rides (REQ-13d) and non-Active statuses (REQ-13c)', async () => {
    mockRideFindMany.mockResolvedValue([ride()]);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.rides).toHaveLength(1);

    expect(mockRideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          providerId: { not: SEEKER_ID }
        }
      })
    );
  });

  it('applies a case-insensitive source filter when provided', async () => {
    mockRideFindMany.mockResolvedValue([ride()]);

    await GET(makeRequest('http://localhost/api/rides/feed?source=Downtown'));

    const arg = mockRideFindMany.mock.calls[0][0];
    expect(arg.where.sourceAddress).toEqual({ contains: 'Downtown', mode: 'insensitive' });
  });

  it('applies a destination filter when provided', async () => {
    mockRideFindMany.mockResolvedValue([ride()]);

    await GET(makeRequest('http://localhost/api/rides/feed?destination=Airport'));

    const arg = mockRideFindMany.mock.calls[0][0];
    expect(arg.where.destinationAddress).toEqual({ contains: 'Airport', mode: 'insensitive' });
  });

  it('applies a ±30 minute departure window by default (REQ-13a)', async () => {
    mockRideFindMany.mockResolvedValue([ride()]);
    const pivot = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await GET(makeRequest(`http://localhost/api/rides/feed?time=${pivot.toISOString()}`));

    const arg = mockRideFindMany.mock.calls[0][0];
    const window = arg.where.departureTime;
    expect(window.gte).toBeInstanceOf(Date);
    expect(window.lte).toBeInstanceOf(Date);
    expect(window.gte.getTime()).toBe(pivot.getTime() - 30 * 60_000);
    expect(window.lte.getTime()).toBe(pivot.getTime() + 30 * 60_000);
  });

  it('honours a custom tolerance window (REQ-13a)', async () => {
    mockRideFindMany.mockResolvedValue([ride()]);
    const pivot = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await GET(
      makeRequest(`http://localhost/api/rides/feed?time=${pivot.toISOString()}&toleranceMinutes=15`)
    );

    const arg = mockRideFindMany.mock.calls[0][0];
    expect(arg.where.departureTime.gte.getTime()).toBe(pivot.getTime() - 15 * 60_000);
    expect(arg.where.departureTime.lte.getTime()).toBe(pivot.getTime() + 15 * 60_000);
  });

  it('filters by minimum available seats (REQ-13b)', async () => {
    mockRideFindMany.mockResolvedValue([ride()]);

    await GET(makeRequest('http://localhost/api/rides/feed?seats=2'));

    const arg = mockRideFindMany.mock.calls[0][0];
    expect(arg.where.seatsAvailable).toEqual({ gte: 2 });
  });

  it('sorts by closest departure time to the requested time', async () => {
    const base = Date.now() + 24 * 60 * 60 * 1000;
    const near = ride({ id: '00000000-0000-4000-8000-000000000001', departureTime: new Date(base).toISOString() });
    const far = ride({ id: '00000000-0000-4000-8000-000000000002', departureTime: new Date(base + 120 * 60_000).toISOString() });
    mockRideFindMany.mockResolvedValue([far, near]);

    const res = await GET(makeRequest(`http://localhost/api/rides/feed?time=${new Date(base).toISOString()}`));

    const body = await res.json();
    expect(body.rides[0].id).toBe(near.id);
    expect(body.rides[1].id).toBe(far.id);
  });

  it('returns 400 for an invalid seats value', async () => {
    const res = await GET(makeRequest('http://localhost/api/rides/feed?seats=0'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.seats[0]).toContain('at least 1');
    expect(mockRideFindMany).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid time value', async () => {
    const res = await GET(makeRequest('http://localhost/api/rides/feed?time=not-a-date'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.details.time).toBeDefined();
    expect(mockRideFindMany).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRideFindMany.mockRejectedValue(new Error('db down'));

    const res = await GET(makeRequest());

    expect(res.status).toBe(500);
  });
});
