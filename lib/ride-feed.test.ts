import { describe, it, expect } from 'vitest';
import { buildRideFeedQuery } from './ride-feed';

describe('buildRideFeedQuery', () => {
  it('returns an empty string when no filters are set', () => {
    expect(buildRideFeedQuery({})).toBe('');
  });

  it('adds source address and pickup coordinates from the source location', () => {
    const query = buildRideFeedQuery({
      source: { latitude: 40.7128, longitude: -74.006, address: 'Downtown' }
    });

    expect(query).toContain('source=Downtown');
    expect(query).toContain('lat=40.7128');
    expect(query).toContain('lng=-74.006');
  });

  it('still sends pickup coordinates when the source address is empty (unresolved geocode)', () => {
    const query = buildRideFeedQuery({
      source: { latitude: 40.7128, longitude: -74.006, address: '' }
    });

    expect(query).not.toContain('source=');
    expect(query).toContain('lat=40.7128');
    expect(query).toContain('lng=-74.006');
  });

  it('adds the destination address when provided', () => {
    const query = buildRideFeedQuery({
      destination: { latitude: 40.6893, longitude: -74.0445, address: 'Airport' }
    });

    expect(query).toContain('destination=Airport');
  });

  it('converts a datetime-local value to an ISO time parameter', () => {
    const query = buildRideFeedQuery({ time: '2026-08-22T09:30' });

    expect(query).toContain('time=');
    expect(new URLSearchParams(query).get('time')).toBe(new Date('2026-08-22T09:30').toISOString());
  });

  it('ignores an invalid time value', () => {
    const query = buildRideFeedQuery({ time: 'not-a-date' });
    expect(query).not.toContain('time=');
  });

  it('adds a numeric seats parameter', () => {
    const query = buildRideFeedQuery({ seats: '2' });
    expect(query).toContain('seats=2');
  });

  it('ignores a non-positive seats value', () => {
    expect(buildRideFeedQuery({ seats: '0' })).not.toContain('seats=');
    expect(buildRideFeedQuery({ seats: '' })).not.toContain('seats=');
  });

  it('combines all filters into a single query string', () => {
    const query = buildRideFeedQuery({
      source: { latitude: 40.7128, longitude: -74.006, address: 'Downtown' },
      destination: { latitude: 40.6893, longitude: -74.0445, address: 'Airport' },
      time: '2026-08-22T09:30',
      seats: '2'
    });
    const params = new URLSearchParams(query);
    expect(params.get('source')).toBe('Downtown');
    expect(params.get('destination')).toBe('Airport');
    expect(params.get('lat')).toBe('40.7128');
    expect(params.get('lng')).toBe('-74.006');
    expect(params.get('seats')).toBe('2');
    expect(params.get('time')).toBe(new Date('2026-08-22T09:30').toISOString());
  });
});
