import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GeocodeProviderError,
  GeocodeRateLimitedError,
  type GeocodeLocation
} from '@/lib/geocode';

const { mockGetSession, mockReverseGeocode } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockReverseGeocode: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  getSession: mockGetSession
}));

// Spread the real module so the route's `instanceof GeocodeProviderError` /
// `instanceof GeocodeRateLimitedError` checks keep working, while the provider
// functions are replaced with mocks.
vi.mock('@/lib/geocode', async () => {
  const actual = await vi.importActual<typeof import('@/lib/geocode')>('@/lib/geocode');
  return {
    ...actual,
    reverseGeocode: mockReverseGeocode,
    searchPlaces: vi.fn()
  };
});

import { GET } from './route';

const session = { user: { id: 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f', email: 'a@b.com', name: null, role: 'USER' } };

function makeRequest(url: string): Request {
  return new Request(`http://localhost/api/geocode/reverse${url}`);
}

const location: GeocodeLocation = {
  latitude: 40.7128,
  longitude: -74.006,
  address: 'Downtown Manhattan, New York, NY, USA',
  placeId: '123'
};

describe('GET /api/geocode/reverse', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockReverseGeocode.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest('?lat=40&lng=-74'));

    expect(res.status).toBe(401);
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it('returns 400 for out-of-range coordinates', async () => {
    const res = await GET(makeRequest('?lat=999&lng=-74'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.lat[0]).toContain('-90');
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it('returns 200 with the resolved location', async () => {
    mockReverseGeocode.mockResolvedValue(location);

    const res = await GET(makeRequest('?lat=40.7128&lng=-74.006'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.location).toEqual(location);
    expect(mockReverseGeocode).toHaveBeenCalledWith(40.7128, -74.006, { userKey: session.user.id });
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mockReverseGeocode.mockRejectedValue(new GeocodeRateLimitedError('Too many requests'));

    const res = await GET(makeRequest('?lat=40&lng=-74'));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('returns 502 when the provider fails', async () => {
    mockReverseGeocode.mockRejectedValue(new GeocodeProviderError('provider down'));

    const res = await GET(makeRequest('?lat=40&lng=-74'));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('manually');
  });
});
