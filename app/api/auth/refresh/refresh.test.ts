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

import { POST, GET } from './route';
import { REFRESH_TOKEN_COOKIE } from '@/lib/tokens';

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

const activeRecord = {
  id: 'rt-old',
  userId: user.id,
  tokenHash: 'h',
  expiresAt: futureDate(),
  revokedAt: null,
  replacedByTokenId: null,
  createdAt: new Date(),
  userAgent: null
};

function makeRequest(refreshToken: string | null, redirectTo?: string): Request {
  const url = new URL('http://localhost/api/auth/refresh');
  if (redirectTo) url.searchParams.set('redirectTo', redirectTo);
  const headers = new Headers({ 'user-agent': 'vitest' });
  if (refreshToken) headers.set('cookie', `${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
  return new Request(url.toString(), { method: 'POST', headers });
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    prismaMocks.mockRefreshFindUnique.mockReset();
    prismaMocks.mockRefreshFindFirst.mockReset();
    prismaMocks.mockRefreshCreate.mockReset();
    prismaMocks.mockRefreshUpdate.mockReset();
    prismaMocks.mockRefreshUpdateMany.mockReset();
    prismaMocks.mockUserFindUnique.mockReset();
  });

  it('returns 401 when the refresh cookie is missing', async () => {
    const res = await POST(makeRequest(null));

    expect(res.status).toBe(401);
    expect(prismaMocks.mockRefreshFindUnique).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and returns fresh cookies', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(activeRecord);
    prismaMocks.mockUserFindUnique.mockResolvedValue(user);
    prismaMocks.mockRefreshCreate.mockResolvedValue({ id: 'rt-new' });
    prismaMocks.mockRefreshUpdate.mockResolvedValue({});

    const res = await POST(makeRequest('valid-refresh-token'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user.id).toBe(user.id);

    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);

    // Old token revoked + linked to its replacement.
    expect(prismaMocks.mockRefreshUpdate).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: { revokedAt: expect.any(Date), replacedByTokenId: 'rt-new' }
    });
  });

  it('returns 401 and clears cookies on reuse of a rotated token', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue({
      ...activeRecord,
      revokedAt: new Date(),
      replacedByTokenId: 'rt-next'
    });
    prismaMocks.mockRefreshFindFirst.mockResolvedValue(null);
    prismaMocks.mockRefreshUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest('stolen-token'));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('reuse');
    // Chain revoked.
    expect(prismaMocks.mockRefreshUpdateMany).toHaveBeenCalled();
  });

  it('returns 401 for an unknown refresh token', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest('ghost-token'));

    expect(res.status).toBe(401);
    expect(prismaMocks.mockRefreshCreate).not.toHaveBeenCalled();
  });

  it('returns 500 for an unexpected database error', async () => {
    prismaMocks.mockRefreshFindUnique.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest('anything'));

    expect(res.status).toBe(500);
  });
});

describe('GET /api/auth/refresh (page-guard redirect flow)', () => {
  it('rotates and redirects to redirectTo when supplied', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(activeRecord);
    prismaMocks.mockUserFindUnique.mockResolvedValue(user);
    prismaMocks.mockRefreshCreate.mockResolvedValue({ id: 'rt-new' });
    prismaMocks.mockRefreshUpdate.mockResolvedValue({});

    const res = await GET(makeRequest('valid-refresh-token', '/dashboard'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
  });

  it('falls back to /dashboard for an absolute redirect target (no open redirect)', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(activeRecord);
    prismaMocks.mockUserFindUnique.mockResolvedValue(user);
    prismaMocks.mockRefreshCreate.mockResolvedValue({ id: 'rt-new' });
    prismaMocks.mockRefreshUpdate.mockResolvedValue({});

    const res = await GET(makeRequest('valid-refresh-token', 'https://evil.example.com'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });
});
