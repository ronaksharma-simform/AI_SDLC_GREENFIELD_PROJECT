import { describe, it, expect } from 'vitest';
import { isRideLocked, isValidUuid } from './rides';

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
