import { describe, it, expect } from 'vitest';
import { REQUEST_STATUS_LABELS, requestStatusLabel, requestStatusVariant } from './request-status';

describe('request status display helpers', () => {
  it('maps every ride request status to a human label', () => {
    expect(REQUEST_STATUS_LABELS).toEqual({
      PENDING: 'Pending',
      ACCEPTED: 'Accepted',
      REJECTED: 'Rejected',
      CANCELLED: 'Cancelled'
    });
  });

  it('returns the raw status string for an unknown status', () => {
    expect(requestStatusLabel('WEIRD')).toBe('WEIRD');
  });

  it('maps Pending to the neutral secondary variant', () => {
    expect(requestStatusVariant('PENDING')).toBe('secondary');
  });

  it('maps Accepted to the positive success variant', () => {
    expect(requestStatusVariant('ACCEPTED')).toBe('success');
  });

  it('maps Rejected to the negative destructive variant', () => {
    expect(requestStatusVariant('REJECTED')).toBe('destructive');
  });

  it('maps Cancelled to the muted outline variant', () => {
    expect(requestStatusVariant('CANCELLED')).toBe('outline');
  });

  it('defaults unknown statuses to secondary', () => {
    expect(requestStatusVariant('WEIRD')).toBe('secondary');
  });
});
