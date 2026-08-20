import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMocks } = vi.hoisted(() => ({
  prismaMocks: {
    mockRefreshFindUnique: vi.fn(),
    mockRefreshFindFirst: vi.fn(),
    mockRefreshCreate: vi.fn(),
    mockRefreshUpdate: vi.fn(),
    mockRefreshUpdateMany: vi.fn(),
    mockUserFindUnique: vi.fn()
  }
}));

vi.mock('@/lib/prisma', () => {
  const prisma = {
    refreshToken: {
      findUnique: prismaMocks.mockRefreshFindUnique,
      findFirst: prismaMocks.mockRefreshFindFirst,
      create: prismaMocks.mockRefreshCreate,
      update: prismaMocks.mockRefreshUpdate,
      updateMany: prismaMocks.mockRefreshUpdateMany
    },
    user: {
      findUnique: prismaMocks.mockUserFindUnique
    },
    $transaction: <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(prisma)
  };
  return { prisma };
});

import { GET } from './route';
import { signAccessToken, generateRefreshToken, hashRefreshToken, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/tokens';

const user = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Ada',
  role: 'DRIVER',
  passwordHash: 'x',
  createdAt: new Date(),
  updatedAt: new Date()
};

function futureDate(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function makeRequest(accessToken?: string, refreshToken?: string): Request {
  const cookies: string[] = [];
  if (accessToken) cookies.push(`${ACCESS_TOKEN_COOKIE}=${accessToken}`);
  if (refreshToken) cookies.push(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
  return new Request('http://localhost/api/auth/session', {
    headers: cookies.length ? { cookie: cookies.join('; ') } : {}
  });
}

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    prismaMocks.mockRefreshFindUnique.mockReset();
    prismaMocks.mockRefreshFindFirst.mockReset();
    prismaMocks.mockRefreshCreate.mockReset();
    prismaMocks.mockRefreshUpdate.mockReset();
    prismaMocks.mockRefreshUpdateMany.mockReset();
    prismaMocks.mockUserFindUnique.mockReset();
  });

  it('reports authenticated for a valid access token', async () => {
    const access = await signAccessToken(user);
    const res = await GET(makeRequest(access));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.id).toBe(user.id);
  });

  it('reports unauthenticated when no cookies are present', async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    expect(body.user).toBeNull();
  });

  it('silently renews and reports authenticated when a valid refresh token exists', async () => {
    const refresh = generateRefreshToken();
    prismaMocks.mockRefreshFindUnique.mockResolvedValue({
      id: 'rt-active',
      userId: user.id,
      tokenHash: await hashRefreshToken(refresh),
      expiresAt: futureDate(),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      userAgent: null
    });
    prismaMocks.mockUserFindUnique.mockResolvedValue(user);
    prismaMocks.mockRefreshCreate.mockResolvedValue({ id: 'rt-new' });
    prismaMocks.mockRefreshUpdate.mockResolvedValue({});

    const res = await GET(makeRequest(undefined, refresh));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(true);
    expect(body.user.id).toBe(user.id);

    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
  });

  it('reports unauthenticated and clears cookies when refresh fails', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest(undefined, 'dead-refresh'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('access_token=') && c.includes('Max-Age=0'))).toBe(true);
  });

  it('returns 500 for an unexpected database error', async () => {
    prismaMocks.mockRefreshFindUnique.mockRejectedValue(new Error('db down'));

    const res = await GET(makeRequest(undefined, 'boom'));

    expect(res.status).toBe(500);
  });
});
