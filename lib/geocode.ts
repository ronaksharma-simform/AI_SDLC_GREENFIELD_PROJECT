/**
 * Backend geocoding proxy.
 *
 * All geocoding requests from the browser go through the API routes that call
 * the functions in this module, so the provider's API key (when one is used)
 * never leaves the server and usage can be rate-limited and cached centrally
 * (Section 7 — External Dependency, Section 11 — Security).
 *
 * The default provider is OpenStreetMap's Nominatim, which needs no API key and
 * is well suited to a low-traffic/prototype deployment. Its usage policy is
 * respected here by (a) sending a descriptive `User-Agent`, (b) rate-limiting
 * per authenticated user, and (c) caching identical lookups for a short window
 * to keep request volume down.
 *
 * The provider can be switched by setting `GEOCODE_BASE_URL` (e.g. a Mapbox or
 * Google-compatible endpoint) without changing the rest of the app.
 */

export interface GeocodeLocation {
  latitude: number;
  longitude: number;
  /** Resolved, human-readable location name (e.g. a display address). */
  address: string;
  /** Provider-specific place identifier, when the provider returns one. */
  placeId?: string;
}

export interface PlaceResult {
  placeId?: string;
  label: string;
  latitude: number;
  longitude: number;
}

/** Thrown when the geocoding provider errors, times out, or returns no result. */
export class GeocodeProviderError extends Error {}

/** Thrown when the per-user request budget is exhausted (Section 10 / 11). */
export class GeocodeRateLimitedError extends Error {}

const NOMINATIM_BASE_URL = process.env.GEOCODE_BASE_URL ?? 'https://nominatim.openstreetmap.org';
const USER_AGENT = process.env.GEOCODE_USER_AGENT ?? 'CoRideApp/1.0 (ride-sharing prototype)';
const REQUEST_TIMEOUT_MS = 8000;

/** TTL for identical-coordinate reverse lookups (Section 10 — short-lived cache). */
const CACHE_TTL_MS = Number(process.env.GEOCODE_CACHE_TTL_MS ?? 5 * 60 * 1000);
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

/** Per-user token bucket: burst allowance and refill rate (tokens/second). */
const RATE_LIMIT_CAPACITY = 5;
const RATE_LIMIT_REFILL_PER_SECOND = 1;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

interface Bucket {
  tokens: number;
  last: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const buckets = new Map<string, Bucket>();

/** Test helper — clears the short-lived coordinate/query cache. */
export function clearGeocodeCache(): void {
  cache.clear();
}

/** Test helper — resets all per-user rate-limit budgets. */
export function resetGeocodeRateLimits(): void {
  buckets.clear();
}

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function consumeToken(userKey: string): boolean {
  const nowSeconds = Date.now() / 1000;
  let bucket = buckets.get(userKey);
  if (!bucket) {
    bucket = { tokens: RATE_LIMIT_CAPACITY, last: nowSeconds };
    buckets.set(userKey, bucket);
  }
  const elapsed = nowSeconds - bucket.last;
  bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + elapsed * RATE_LIMIT_REFILL_PER_SECOND);
  bucket.last = nowSeconds;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

function assertWithinRateLimit(userKey: string): void {
  if (!consumeToken(userKey)) {
    throw new GeocodeRateLimitedError('Too many geocoding requests. Please try again shortly.');
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function requestInit(): RequestInit {
  return {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'application/json'
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  };
}

/**
 * Reverse-geocodes a coordinate pair into a human-readable address/place name.
 *
 * Identical (to ~1m) recent lookups are served from the in-memory cache instead
 * of re-calling the provider (Section 10 — business rules).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options: { userKey?: string; fetchImpl?: FetchLike } = {}
): Promise<GeocodeLocation> {
  const key = `r:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = cacheGet<GeocodeLocation>(key);
  if (cached) return cached;

  assertWithinRateLimit(options.userKey ?? 'anonymous');

  const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=en`;
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(url, requestInit());

  if (!res.ok) {
    throw new GeocodeProviderError(`Geocoding provider returned HTTP ${res.status}.`);
  }

  const data = (await res.json()) as {
    display_name?: string;
    place_id?: number | string;
    lat?: number | string;
    lon?: number | string;
  };

  if (!data.display_name) {
    throw new GeocodeProviderError('Geocoding provider returned no result for these coordinates.');
  }

  const location: GeocodeLocation = {
    latitude: Number(data.lat ?? latitude),
    longitude: Number(data.lon ?? longitude),
    address: data.display_name,
    placeId: data.place_id !== undefined && data.place_id !== null ? String(data.place_id) : undefined
  };

  cacheSet(key, location, CACHE_TTL_MS);
  return location;
}

/**
 * Forward-geocodes a free-text query into a short list of candidate places,
 * used by the picker's search box. Results are cached by normalized query.
 */
export async function searchPlaces(
  query: string,
  options: { userKey?: string; fetchImpl?: FetchLike } = {}
): Promise<PlaceResult[]> {
  const normalized = query.trim().toLowerCase();
  const key = `s:${normalized}`;
  const cached = cacheGet<PlaceResult[]>(key);
  if (cached) return cached;

  assertWithinRateLimit(options.userKey ?? 'anonymous');

  const url = `${NOMINATIM_BASE_URL}/search?format=jsonv2&q=${encodeURIComponent(normalized)}&limit=6&accept-language=en`;
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(url, requestInit());

  if (!res.ok) {
    throw new GeocodeProviderError(`Geocoding provider returned HTTP ${res.status}.`);
  }

  const data = (await res.json()) as Array<{
    display_name?: string;
    place_id?: number | string;
    lat?: number | string;
    lon?: number | string;
  }>;

  if (!Array.isArray(data)) {
    throw new GeocodeProviderError('Geocoding provider returned an unexpected response shape.');
  }

  const results: PlaceResult[] = data
    .map((item) => ({
      placeId: item.place_id !== undefined && item.place_id !== null ? String(item.place_id) : undefined,
      label: item.display_name ?? '',
      latitude: Number(item.lat),
      longitude: Number(item.lon)
    }))
    .filter((result) => result.label && Number.isFinite(result.latitude) && Number.isFinite(result.longitude));

  cacheSet(key, results, SEARCH_CACHE_TTL_MS);
  return results;
}
