import { describe, it, expect } from 'vitest';
import {
  isRideLocked,
  isValidUuid,
  distanceMeters,
  areLocationsTooClose,
  MIN_LOCATION_DISTANCE_METERS
} from './rides';

describe('isRideLocked', () => {
  it('returns false when no seats have been accepted', () => {
    expect(isRideLocked({ seatsAvailable: 4, seatsTotal: 4 })).toBe(false);
  });

  it('returns true when at least one seat has been accepted', () => {
    expect(isRideLocked({ seatsAvailable: 2, seatsTotal: 4 })).toBe(true);
  });

  it('returns true when every seat is taken', () => {
    expect(isRideLocked({ seatsAvailable: 0, seatsTotal: 4 })).toBe(true);
  });
});

describe('isValidUuid', () => {
  it('returns true for a standard v4 UUID', () => {
    expect(isValidUuid('e6b9c1f8-3b3d-4b2f-9f2f-2f2f2f2f2f2f')).toBe(true);
  });

  it('returns false for non-UUID strings', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('')).toBe(false);
  });
});

describe('distanceMeters', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(distanceMeters({ latitude: 40.7128, longitude: -74.006 }, { latitude: 40.7128, longitude: -74.006 })).toBeLessThan(0.001);
  });

  it('returns a large distance for far-apart coordinates (NYC to London)', () => {
    const d = distanceMeters(
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 51.5074, longitude: -0.1278 }
    );
    expect(d).toBeGreaterThan(5_000_000);
  });
});

describe('areLocationsTooClose', () => {
  it('returns true for the exact same point', () => {
    const a = { latitude: 40.7128, longitude: -74.006 };
    expect(areLocationsTooClose(a, a)).toBe(true);
  });

  it('returns true for points closer than the minimum distance', () => {
    // ~0.0005 degrees of latitude is roughly 55m; within the 50m boundary it is
    // on the edge, so use a much smaller offset (~10m) to stay well inside.
    const a = { latitude: 40.7128, longitude: -74.006 };
    const b = { latitude: 40.7128 + 0.00009, longitude: -74.006 };
    expect(areLocationsTooClose(a, b)).toBe(true);
  });

  it('returns false for points farther apart than the minimum distance', () => {
    const a = { latitude: 40.7128, longitude: -74.006 };
    const b = { latitude: 40.7128 + 0.01, longitude: -74.006 };
    expect(distanceMeters(a, b)).toBeGreaterThan(MIN_LOCATION_DISTANCE_METERS);
    expect(areLocationsTooClose(a, b)).toBe(false);
  });
});
