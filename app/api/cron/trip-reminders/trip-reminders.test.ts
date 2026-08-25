import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockProcessTripReminders } = vi.hoisted(() => ({
  mockProcessTripReminders: vi.fn()
}));

vi.mock('@/lib/reminders', () => ({
  processTripReminders: mockProcessTripReminders
}));

import { GET } from './route';

describe('GET /api/cron/trip-reminders', () => {
  beforeEach(() => {
    mockProcessTripReminders.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled (503) when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const res = await GET(new Request('http://localhost'));

    expect(res.status).toBe(503);
    expect(mockProcessTripReminders).not.toHaveBeenCalled();
  });

  it('rejects a request with a missing or incorrect secret (403)', async () => {
    vi.stubEnv('CRON_SECRET', 'correct-secret');

    const missing = await GET(new Request('http://localhost'));
    expect(missing.status).toBe(403);

    const wrong = await GET(
      new Request('http://localhost', { headers: { 'x-cron-secret': 'wrong' } })
    );
    expect(wrong.status).toBe(403);

    expect(mockProcessTripReminders).not.toHaveBeenCalled();
  });

  it('runs the reminder job when the secret matches', async () => {
    vi.stubEnv('CRON_SECRET', 'correct-secret');
    mockProcessTripReminders.mockResolvedValue({ ridesProcessed: 2, notificationsCreated: 5 });

    const res = await GET(
      new Request('http://localhost', { headers: { 'x-cron-secret': 'correct-secret' } })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.ridesProcessed).toBe(2);
    expect(body.notificationsCreated).toBe(5);
    expect(mockProcessTripReminders).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the job throws', async () => {
    vi.stubEnv('CRON_SECRET', 'correct-secret');
    mockProcessTripReminders.mockRejectedValue(new Error('db down'));

    const res = await GET(
      new Request('http://localhost', { headers: { 'x-cron-secret': 'correct-secret' } })
    );

    expect(res.status).toBe(500);
  });
});
