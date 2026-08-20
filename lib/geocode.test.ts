import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  reverseGeocode,
  searchPlaces,
  GeocodeProviderError,
  GeocodeRateLimitedError,
  clearGeocodeCache,
  resetGeocodeRateLimits
} from './geocode';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('reverseGeocode', () => {
  beforeEach(() => {
    clearGeocodeCache();
    resetGeocodeRateLimits();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a structured location from the provider response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        display_name: '1 Main St, Springfield, USA',
        place_id: 123456,
        lat: '40.7128',
        lon: '-74.0060'
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await reverseGeocode(40.7128, -74.006, { userKey: 'user-1' });

    expect(result).toEqual({
      latitude: 40.7128,
      longitude: -74.006,
      address: '1 Main St, Springfield, USA',
      placeId: '123456'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/reverse'),
      expect.objectContaining({
        headers: expect.objectContaining({ accept: 'application/json', 'user-agent': expect.any(String) })
      })
    );
  });

  it('serves identical coordinate lookups from the cache without a second call', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ display_name: 'Same Place', place_id: 1, lat: '1.1', lon: '2.2' })
    );
    vi.stubGlobal('fetch', fetchMock);

    await reverseGeocode(1.123456, 2.123456, { userKey: 'user-1' });
    await reverseGeocode(1.123457, 2.123457, { userKey: 'user-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws GeocodeProviderError when the provider returns a non-OK status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'boom' }, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(reverseGeocode(10, 20, { userKey: 'user-1' })).rejects.toBeInstanceOf(
      GeocodeProviderError
    );
  });

  it('throws GeocodeProviderError when the provider returns no display_name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ place_id: 1, lat: '1', lon: '2' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(reverseGeocode(10, 20, { userKey: 'user-1' })).rejects.toBeInstanceOf(
      GeocodeProviderError
    );
  });

  it('throws GeocodeRateLimitedError once the per-user budget is exhausted', async () => {
    // Fresh Response per call: the provider is hit for each distinct coordinate.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ display_name: 'X', place_id: 1, lat: '1', lon: '2' }))
    );
    vi.stubGlobal('fetch', fetchMock);

    // Each distinct coordinate consumes a token; the 6th request exceeds the
    // capacity of 5 (refill only happens over time, so within the same tick the
    // budget stays exhausted).
    for (let i = 0; i < 5; i += 1) {
      await reverseGeocode(i + 1, i + 1, { userKey: 'user-1' });
    }
    await expect(reverseGeocode(99, 99, { userKey: 'user-1' })).rejects.toBeInstanceOf(
      GeocodeRateLimitedError
    );
  });
});

describe('searchPlaces', () => {
  beforeEach(() => {
    clearGeocodeCache();
    resetGeocodeRateLimits();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns mapped results and filters out invalid entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([
        { display_name: 'Springfield, MA, USA', place_id: 'a1', lat: '42.10', lon: '-72.59' },
        { display_name: 'Springfield, IL, USA', place_id: 'b2', lat: '39.78', lon: '-89.65' },
        { display_name: '', place_id: 'c3', lat: '0', lon: '0' }
      ])
    );
    vi.stubGlobal('fetch', fetchMock);

    const results = await searchPlaces('Springfield', { userKey: 'user-1' });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      placeId: 'a1',
      label: 'Springfield, MA, USA',
      latitude: 42.1,
      longitude: -72.59
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/search'),
      expect.any(Object)
    );
  });

  it('serves the same normalized query from cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await searchPlaces('  Central Park  ', { userKey: 'user-1' });
    await searchPlaces('central park', { userKey: 'user-1' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws GeocodeProviderError on a non-OK provider response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 429));
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchPlaces('anything', { userKey: 'user-1' })).rejects.toBeInstanceOf(
      GeocodeProviderError
    );
  });
});
