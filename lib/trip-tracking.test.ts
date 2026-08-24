import { describe, it, expect } from 'vitest';
import {
  canStartTrip,
  canAcceptLocationUpdates,
  canCompleteTrip,
  isLocationStale,
  secondsSinceLastUpdate
} from '@/lib/trip-tracking';

describe('trip lifecycle helpers', () => {
  describe('canStartTrip', () => {
    it('allows starting from Active or Full (Section 11)', () => {
      expect(canStartTrip('ACTIVE')).toBe(true);
      expect(canStartTrip('FULL')).toBe(true);
    });

    it('rejects starting an already-started, completed, or cancelled ride', () => {
      expect(canStartTrip('IN_PROGRESS')).toBe(false);
      expect(canStartTrip('COMPLETED')).toBe(false);
      expect(canStartTrip('CANCELLED')).toBe(false);
    });
  });

  describe('canAcceptLocationUpdates', () => {
    it('only accepts updates while In Progress (REQ-7 / Section 11)', () => {
      expect(canAcceptLocationUpdates('IN_PROGRESS')).toBe(true);
      expect(canAcceptLocationUpdates('ACTIVE')).toBe(false);
      expect(canAcceptLocationUpdates('FULL')).toBe(false);
      expect(canAcceptLocationUpdates('COMPLETED')).toBe(false);
      expect(canAcceptLocationUpdates('CANCELLED')).toBe(false);
    });
  });

  describe('canCompleteTrip', () => {
    it('only allows completing a started trip (Section 11)', () => {
      expect(canCompleteTrip('IN_PROGRESS')).toBe(true);
      expect(canCompleteTrip('ACTIVE')).toBe(false);
      expect(canCompleteTrip('FULL')).toBe(false);
      expect(canCompleteTrip('COMPLETED')).toBe(false);
      expect(canCompleteTrip('CANCELLED')).toBe(false);
    });
  });

  describe('isLocationStale', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');

    it('treats a missing update as stale', () => {
      expect(isLocationStale(null, now)).toBe(true);
      expect(isLocationStale(undefined, now)).toBe(true);
    });

    it('treats a fresh update as not stale', () => {
      const fresh = new Date(now.getTime() - 10_000);
      expect(isLocationStale(fresh, now)).toBe(false);
    });

    it('treats an update older than the timeout as stale (REQ-9)', () => {
      const old = new Date(now.getTime() - 60_000);
      expect(isLocationStale(old, now)).toBe(true);
    });

    it('accepts an ISO string timestamp', () => {
      const freshIso = new Date(now.getTime() - 5_000).toISOString();
      expect(isLocationStale(freshIso, now)).toBe(false);
    });

    it('honours a custom timeout', () => {
      const older = new Date(now.getTime() - 10_000);
      expect(isLocationStale(older, now, 5_000)).toBe(true);
      expect(isLocationStale(older, now, 20_000)).toBe(false);
    });
  });

  describe('secondsSinceLastUpdate', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');

    it('returns null when there is no update', () => {
      expect(secondsSinceLastUpdate(null, now)).toBeNull();
    });

    it('returns whole seconds since the update, floored', () => {
      const updated = new Date(now.getTime() - 12_500);
      expect(secondsSinceLastUpdate(updated, now)).toBe(12);
    });

    it('never returns a negative value for a future timestamp', () => {
      const future = new Date(now.getTime() + 5_000);
      expect(secondsSinceLastUpdate(future, now)).toBe(0);
    });
  });
});
