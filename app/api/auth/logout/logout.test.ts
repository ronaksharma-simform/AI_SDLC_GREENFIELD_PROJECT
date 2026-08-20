import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRefreshUpdateMany } = vi.hoisted(() => ({
  mockRefreshUpdateMany: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: { updateMany: mockRefreshUpdateMany }
  }
}));

import { POST } from './route';
import { REFRESH_TOKEN_COOKIE } from '@/lib/tokens';

function makeRequest(refreshToken: string | null): Request {
  const headers = new Headers();
  if (refreshToken) headers.set('cookie', `${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
  return new Request('http://localhost/api/auth/logout', { method: 'POST', headers });
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    mockRefreshUpdateMany.mockReset();
    mockRefreshUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('revokes the refresh token server-side and clears both cookies', async () => {
    const res = await POST(makeRequest('logout-token'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // The hashed refresh token is marked revoked.
    expect(mockRefreshUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      data: { revokedAt: expect.any(Date) }
    });

    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('access_token=') && c.includes('Max-Age=0'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token=') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('clears cookies even when no refresh token is present', async () => {
    const res = await POST(makeRequest(null));

    expect(res.status).toBe(200);
    expect(mockRefreshUpdateMany).not.toHaveBeenCalled();
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('access_token=') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('returns 500 for an unexpected database error', async () => {
    mockRefreshUpdateMany.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest('logout-token'));

    expect(res.status).toBe(500);
  });
});
