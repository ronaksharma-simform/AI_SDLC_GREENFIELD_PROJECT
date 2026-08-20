import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeocodeProviderError, GeocodeRateLimitedError } from '@/lib/geocode';

const { mockGetSession, mockSearchPlaces } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockSearchPlaces: vi.fn()
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
    reverseGeocode: vi.fn(),
    searchPlaces: mockSearchPlaces
  };
});

import { GET } from './route';

const session = { user: { id: 'e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f', email: 'a@b.com', name: null, role: 'USER' } };

function makeRequest(url: string): Request {
  return new Request(`http://localhost/api/geocode/search${url}`);
}

describe('GET /api/geocode/search', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockSearchPlaces.mockReset();
    mockGetSession.mockResolvedValue(session);
  });

  it('returns 401 when no session is present', async () => {
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest('?query=Springfield'));

    expect(res.status).toBe(401);
    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty query', async () => {
    const res = await GET(makeRequest('?query='));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.details.query[0]).toContain('required');
    expect(mockSearchPlaces).not.toHaveBeenCalled();
  });

  it('returns 200 with mapped results', async () => {
    mockSearchPlaces.mockResolvedValue([
      { placeId: 'a1', label: 'Springfield, MA, USA', latitude: 42.1, longitude: -72.59 }
    ]);

    const res = await GET(makeRequest('?query=Springfield'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.results).toHaveLength(1);
    expect(mockSearchPlaces).toHaveBeenCalledWith('Springfield', { userKey: session.user.id });
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    mockSearchPlaces.mockRejectedValue(new GeocodeRateLimitedError('Too many requests'));

    const res = await GET(makeRequest('?query=Springfield'));

    expect(res.status).toBe(429);
  });

  it('returns 502 when the provider fails', async () => {
    mockSearchPlaces.mockRejectedValue(new GeocodeProviderError('provider down'));

    const res = await GET(makeRequest('?query=Springfield'));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain('map');
  });
});
