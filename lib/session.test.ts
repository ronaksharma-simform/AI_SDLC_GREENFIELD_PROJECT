import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma mock. The `$transaction` helper runs its callback against the same
// (mocked) client so rotation logic is exercised end-to-end without a DB.
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

import {
  createSession,
  rotateSession,
  revokeSession,
  getSessionFromRequest,
  getSessionFromRequestWithRefresh,
  TokenError
} from '@/lib/session';
import { signAccessToken, generateRefreshToken, hashRefreshToken, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/tokens';

const user = {
  id: 'user-1',
  email: 'driver@example.com',
  name: 'Ada',
  role: 'DRIVER',
  passwordHash: 'irrelevant',
  createdAt: new Date(),
  updatedAt: new Date()
};

function futureDate(days = 7): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function makeRequest(accessToken?: string | null, refreshToken?: string | null): Request {
  const cookies: string[] = [];
  if (accessToken) cookies.push(`${ACCESS_TOKEN_COOKIE}=${accessToken}`);
  if (refreshToken) cookies.push(`${REFRESH_TOKEN_COOKIE}=${refreshToken}`);
  return new Request('http://localhost/api/resource', {
    method: 'POST',
    headers: cookies.length ? { cookie: cookies.join('; ') } : {}
  });
}

describe('createSession', () => {
  beforeEach(() => {
    prismaMocks.mockRefreshCreate.mockReset();
    prismaMocks.mockRefreshCreate.mockResolvedValue({ id: 'rt-1' });
  });

  it('issues an access + refresh token pair and stores only the hashed refresh token', async () => {
    const pair = await createSession(user, 'CoRide/1.0');

    // Access token is a signed JWT for this user.
    expect(pair.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    // Refresh token is the raw base64url value.
    expect(pair.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    expect(prismaMocks.mockRefreshCreate).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        tokenHash: await hashRefreshToken(pair.refreshToken),
        expiresAt: expect.any(Date),
        userAgent: 'CoRide/1.0'
      }
    });
    // The stored hash is NOT the raw token.
    expect((prismaMocks.mockRefreshCreate.mock.calls[0][0] as { data: { tokenHash: string } }).data.tokenHash).not.toBe(pair.refreshToken);
  });
});

describe('rotateSession (refresh rotation)', () => {
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

  beforeEach(() => {
    prismaMocks.mockRefreshFindUnique.mockReset();
    prismaMocks.mockRefreshFindFirst.mockReset();
    prismaMocks.mockRefreshCreate.mockReset();
    prismaMocks.mockRefreshUpdate.mockReset();
    prismaMocks.mockRefreshUpdateMany.mockReset();
    prismaMocks.mockUserFindUnique.mockReset();
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(activeRecord);
    prismaMocks.mockUserFindUnique.mockResolvedValue(user);
    prismaMocks.mockRefreshCreate.mockResolvedValue({ id: 'rt-new' });
    prismaMocks.mockRefreshUpdate.mockResolvedValue({});
  });

  it('rotates: issues a new pair, revokes the old record, and links the replacement', async () => {
    const rotated = await rotateSession('refresh-token-value', 'Agent');

    expect(rotated.user).toEqual({ id: user.id, email: user.email, name: user.name, role: user.role });
    expect(rotated.accessToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(rotated.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // Old token revoked + linked to the replacement.
    expect(prismaMocks.mockRefreshUpdate).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: { revokedAt: expect.any(Date), replacedByTokenId: 'rt-new' }
    });
    // New token persisted for the same user.
    expect(prismaMocks.mockRefreshCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: user.id, userAgent: 'Agent' })
    });
  });

  it('rejects reuse of an already-rotated token and revokes the chain', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue({
      ...activeRecord,
      revokedAt: new Date(),
      replacedByTokenId: 'rt-next'
    });
    prismaMocks.mockRefreshFindFirst.mockResolvedValue(null);

    await expect(rotateSession('stolen-token')).rejects.toMatchObject({
      name: 'TokenError',
      code: 'reuse',
      status: 401
    });

    // The chain (reused token + successor) is revoked; nothing new is issued.
    expect(prismaMocks.mockRefreshUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(['rt-old', 'rt-next']) } },
      data: { revokedAt: expect.any(Date) }
    });
    expect(prismaMocks.mockRefreshCreate).not.toHaveBeenCalled();
  });

  it('rejects an expired refresh token', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue({
      ...activeRecord,
      expiresAt: new Date(Date.now() - 1000)
    });

    await expect(rotateSession('expired-token')).rejects.toMatchObject({
      name: 'TokenError',
      code: 'expired'
    });
    expect(prismaMocks.mockRefreshCreate).not.toHaveBeenCalled();
  });

  it('rejects an unknown refresh token', async () => {
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(null);

    await expect(rotateSession('ghost-token')).rejects.toMatchObject({
      name: 'TokenError',
      code: 'invalid'
    });
    expect(prismaMocks.mockRefreshCreate).not.toHaveBeenCalled();
  });
});

describe('revokeSession (logout)', () => {
  it('marks the hashed refresh token as revoked', async () => {
    prismaMocks.mockRefreshUpdateMany.mockReset();
    prismaMocks.mockRefreshUpdateMany.mockResolvedValue({ count: 1 });

    await revokeSession('logout-token');

    expect(prismaMocks.mockRefreshUpdateMany).toHaveBeenCalledWith({
      where: { tokenHash: await hashRefreshToken('logout-token') },
      data: { revokedAt: expect.any(Date) }
    });
  });
});

describe('getSessionFromRequest / getSessionFromRequestWithRefresh', () => {
  beforeEach(() => {
    prismaMocks.mockRefreshFindUnique.mockReset();
    prismaMocks.mockRefreshFindFirst.mockReset();
    prismaMocks.mockRefreshCreate.mockReset();
    prismaMocks.mockRefreshUpdate.mockReset();
    prismaMocks.mockRefreshUpdateMany.mockReset();
    prismaMocks.mockUserFindUnique.mockReset();
  });

  it('resolves the user from a valid access token', async () => {
    const access = await signAccessToken(user);
    const session = await getSessionFromRequest(makeRequest(access));

    expect(session).toEqual({ id: user.id, email: user.email, name: user.name, role: user.role });
  });

  it('returns null for no / invalid access token', async () => {
    await expect(getSessionFromRequest(makeRequest(undefined))).resolves.toBeNull();
    await expect(getSessionFromRequest(makeRequest('not-a-jwt'))).resolves.toBeNull();
  });

  it('silently renews when the access token is missing but a valid refresh token exists', async () => {
    prismaMocks.mockRefreshFindUnique.mockReset();
    prismaMocks.mockRefreshFindFirst.mockReset();
    prismaMocks.mockRefreshCreate.mockReset();
    prismaMocks.mockRefreshUpdate.mockReset();
    prismaMocks.mockUserFindUnique.mockReset();

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

    const result = await getSessionFromRequestWithRefresh(makeRequest(undefined, refresh));

    expect(result.user).toEqual({ id: user.id, email: user.email, name: user.name, role: user.role });
    expect(result.rotatedTokens).toBeDefined();
    expect(result.rotatedTokens?.accessToken).toMatch(/\./);
  });

  it('does not rotate when the access token is already valid', async () => {
    const access = await signAccessToken(user);
    const result = await getSessionFromRequestWithRefresh(makeRequest(access, 'whatever'));

    expect(result.user?.id).toBe(user.id);
    expect(result.rotatedTokens).toBeUndefined();
    expect(prismaMocks.mockRefreshFindUnique).not.toHaveBeenCalled();
  });

  it('returns no session when refresh also fails', async () => {
    prismaMocks.mockRefreshFindUnique.mockReset();
    prismaMocks.mockRefreshFindUnique.mockResolvedValue(null);

    const result = await getSessionFromRequestWithRefresh(makeRequest(undefined, 'dead-refresh'));
    expect(result.user).toBeNull();
    expect(result.rotatedTokens).toBeUndefined();
  });
});

// TokenError keeps helper signature used above.
void TokenError;
