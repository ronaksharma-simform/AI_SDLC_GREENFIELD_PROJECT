import { describe, it, expect, vi } from 'vitest';

// The pure helpers under test don't touch the database, but `lib/payments`
// imports the Prisma singleton at module load. Mock it so this unit test never
// instantiates a real PrismaClient.
vi.mock('@/lib/prisma', () => ({
  prisma: {}
}));

import { computeCostPerSeat } from '@/lib/payments';
import { formatRupees, rupeesToPaise, paiseToRupees } from '@/lib/format-money';

describe('computeCostPerSeat', () => {
  it('splits the cost evenly across the provider + every accepted Seeker (PAY-2)', () => {
    // ₹120 = 12000 paise over the provider + 3 accepted Seekers = 4 occupants.
    expect(computeCostPerSeat(12000, 3)).toBe(3000);
  });

  it('with no accepted Seekers the provider alone bears the whole cost', () => {
    expect(computeCostPerSeat(12000, 0)).toBe(12000);
  });

  it('rounds each share UP so the sum of shares never falls short of totalCost (§12)', () => {
    // 10000 paise / 3 occupants = 3333.33… -> 3334; 3 × 3334 = 10002 >= 10000.
    expect(computeCostPerSeat(10000, 2)).toBe(3334);
    expect(computeCostPerSeat(10000, 2) * 3).toBeGreaterThanOrEqual(10000);
  });

  it('accepts string or Decimal-like inputs', () => {
    expect(computeCostPerSeat('12000', 1)).toBe(6000);
    expect(computeCostPerSeat({ toString: () => '12000' }, 1)).toBe(6000);
  });

  it('returns 0 for a non-positive cost (defensive)', () => {
    expect(computeCostPerSeat(0, 1)).toBe(0);
    expect(computeCostPerSeat(-5, 1)).toBe(0);
    expect(computeCostPerSeat(Number.NaN, 1)).toBe(0);
  });

  it('ignores a negative accepted-request count defensively', () => {
    expect(computeCostPerSeat(12000, -3)).toBe(12000);
  });
});

describe('formatRupees', () => {
  it('formats paise as a rupee string with two decimals', () => {
    expect(formatRupees(12000)).toBe('₹120.00');
    expect(formatRupees(3013)).toBe('₹30.13');
  });

  it('handles numeric strings and Decimal-like objects', () => {
    expect(formatRupees('12000')).toBe('₹120.00');
    expect(formatRupees({ toString: () => '3013' })).toBe('₹30.13');
  });

  it('returns an empty string for null / undefined / empty input', () => {
    expect(formatRupees(null)).toBe('');
    expect(formatRupees(undefined)).toBe('');
    expect(formatRupees('')).toBe('');
  });
});

describe('rupeesToPaise / paiseToRupees', () => {
  it('round-trips a rupee amount to the nearest paise integer', () => {
    expect(rupeesToPaise(120)).toBe(12000);
    expect(rupeesToPaise(120.5)).toBe(12050);
    expect(rupeesToPaise(30.13)).toBe(3013);
  });

  it('converts stored paise back to a rupee number', () => {
    expect(paiseToRupees(12000)).toBe(120);
    expect(paiseToRupees(3013)).toBe(30.13);
    expect(paiseToRupees(null)).toBe(0);
  });
});
