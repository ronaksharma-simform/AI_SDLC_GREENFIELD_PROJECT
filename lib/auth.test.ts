import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCookies, mockRefreshFindUnique } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockRefreshFindUnique: vi.fn()
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: { findUnique: mockRefreshFindUnique }
  }
}));

import { getSession, hasValidRefreshToken } from '@/lib/auth';
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE
} from '@/lib/tokens';

const user = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Ada',
  role: 'DRIVER'
};

function cookieStore(entries: Record<string, string>) {
  return {
    get: (name: string) => (entries[name] !== undefined ? { name, value: entries[name] } : undefined)
  };
}

describe('getSession (server-component access-token check)', () => {
  beforeEach(() => {
    mockCookies.mockReset();
    mockRefreshFindUnique.mockReset();
  });

  it('returns the user for a valid access token', async () => {
    const access = await signAccessToken(user);
    mockCookies.mockResolvedValue(cookieStore({ [ACCESS_TOKEN_COOKIE]: access }));

    await expect(getSession()).resolves.toEqual(user);
  });

  it('returns null when no access token is present', async () => {
    mockCookies.mockResolvedValue(cookieStore({}));

    await expect(getSession()).resolves.toBeNull();
  });

  it('returns null for an invalid access token', async () => {
    mockCookies.mockResolvedValue(cookieStore({ [ACCESS_TOKEN_COOKIE]: 'not-a-jwt' }));

    await expect(getSession()).resolves.toBeNull();
  });
});

describe('hasValidRefreshToken (page-guard refreshable check)', () => {
  const activeRecord = {
    id: 'rt-1',
    userId: user.id,
    tokenHash: 'h',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    replacedByTokenId: null,
    createdAt: new Date(),
    userAgent: null
  };

  beforeEach(() => {
    mockCookies.mockReset();
    mockRefreshFindUnique.mockReset();
  });

  it('returns true when a valid, unrotated refresh token exists', async () => {
    const refresh = generateRefreshToken();
    mockCookies.mockResolvedValue(cookieStore({ [REFRESH_TOKEN_COOKIE]: refresh }));
    mockRefreshFindUnique.mockResolvedValue(activeRecord);

    await expect(hasValidRefreshToken()).resolves.toBe(true);
    expect(mockRefreshFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: await hashRefreshToken(refresh) }
    });
  });

  it('returns false when the refresh token was already rotated', async () => {
    mockCookies.mockResolvedValue(cookieStore({ [REFRESH_TOKEN_COOKIE]: 't' }));
    mockRefreshFindUnique.mockResolvedValue({ ...activeRecord, revokedAt: new Date(), replacedByTokenId: 'rt-next' });

    await expect(hasValidRefreshToken()).resolves.toBe(false);
  });

  it('returns false when the refresh token is expired', async () => {
    mockCookies.mockResolvedValue(cookieStore({ [REFRESH_TOKEN_COOKIE]: 't' }));
    mockRefreshFindUnique.mockResolvedValue({ ...activeRecord, expiresAt: new Date(Date.now() - 1000) });

    await expect(hasValidRefreshToken()).resolves.toBe(false);
  });

  it('returns false when no refresh record exists', async () => {
    mockCookies.mockResolvedValue(cookieStore({ [REFRESH_TOKEN_COOKIE]: 't' }));
    mockRefreshFindUnique.mockResolvedValue(null);

    await expect(hasValidRefreshToken()).resolves.toBe(false);
  });

  it('returns false when no refresh cookie is present', async () => {
    mockCookies.mockResolvedValue(cookieStore({}));

    await expect(hasValidRefreshToken()).resolves.toBe(false);
    expect(mockRefreshFindUnique).not.toHaveBeenCalled();
  });
});
