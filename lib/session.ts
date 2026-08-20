import type { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  readCookie,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS
} from '@/lib/tokens';

/**
 * Session orchestration for the two-token model.
 *
 * This module performs the database-backed parts of the session lifecycle:
 *   - `createSession`  — issue a token pair on login and persist the hashed
 *                         refresh token.
 *   - `rotateSession`  — validate + rotate a refresh token (REQ-7/REQ-8), and
 *                         detect reuse of a retired token (REQ-9).
 *   - `revokeSession`  — revoke the current refresh token on logout (REQ-10).
 *   - `getSessionFromRequest` / `getSessionFromRequestWithRefresh` — resolve
 *                         the caller's identity from the access-token cookie.
 *
 * Cookie headers are parsed from the raw `Cookie` header (rather than
 * `next/headers`) so route handlers and their tests stay request-based.
 */

/** Public user shape exposed to pages/API consumers. */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RotatedSession {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

/** Error carrying an HTTP status + machine-readable code for auth failures. */
export class TokenError extends Error {
  readonly status: number;
  readonly code: 'invalid' | 'expired' | 'reuse' | 'user-not-found';

  constructor(message: string, status: number, code: TokenError['code']) {
    super(message);
    this.name = 'TokenError';
    this.status = status;
    this.code = code;
  }
}

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

function toSessionUser(user: UserRecord): SessionUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Secure cookies are only set over HTTPS; local/demo HTTP keeps working. */
export function cookiesAreSecure(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Sets the access + refresh cookies on a response. */
export function setSessionCookies(response: NextResponse, tokens: TokenPair): void {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: tokens.accessToken,
    httpOnly: true,
    secure: cookiesAreSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TOKEN_TTL_SECONDS
  });
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: tokens.refreshToken,
    httpOnly: true,
    secure: cookiesAreSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS
  });
}

/** Clears both session cookies on a response (logout / rejected refresh). */
export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: '',
    httpOnly: true,
    secure: cookiesAreSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: '',
    httpOnly: true,
    secure: cookiesAreSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
}

/**
 * Issues a fresh token pair and persists the hashed refresh token. Called
 * after credentials have been verified by the login route.
 */
export async function createSession(
  user: UserRecord,
  userAgent?: string
): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  const accessToken = await signAccessToken(user);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: await hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiresAt(),
      userAgent: userAgent ? userAgent.slice(0, 500) : null
    }
  });

  return { accessToken, refreshToken };
}

/**
 * Validates a refresh token and rotates it (REQ-7/REQ-8).
 *
 * On success the old record is revoked and linked to its replacement, and a
 * brand-new token pair is returned. On failure (missing, expired, revoked, or
 * reused) a `TokenError` is thrown; reuse detection revokes the entire chain
 * first (REQ-9).
 */
export async function rotateSession(
  refreshTokenValue: string,
  userAgent?: string
): Promise<RotatedSession> {
  const tokenHash = await hashRefreshToken(refreshTokenValue);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!record) {
    throw new TokenError('Refresh token is invalid.', 401, 'invalid');
  }

  const now = new Date();
  if (record.expiresAt < now) {
    throw new TokenError('Refresh token has expired.', 401, 'expired');
  }

  // A token that was already rotated (or manually revoked) should never be
  // presented again. Doing so is a strong signal the token was stolen.
  if (record.revokedAt !== null || record.replacedByTokenId !== null) {
    await revokeTokenChain(record.id, record.replacedByTokenId);
    throw new TokenError('Refresh token reuse detected.', 401, 'reuse');
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: record.userId } });
    if (!user) {
      throw new TokenError('The user for this session no longer exists.', 401, 'user-not-found');
    }

    const refreshToken = generateRefreshToken();
    const accessToken = await signAccessToken(user);
    const created = await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await hashRefreshToken(refreshToken),
        expiresAt: refreshTokenExpiresAt(),
        userAgent: userAgent ? userAgent.slice(0, 500) : null
      }
    });

    await tx.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: now, replacedByTokenId: created.id }
    });

    return { user: toSessionUser(user), accessToken, refreshToken };
  });
}

/**
 * Revokes the current refresh token (logout). The raw cookie value is hashed
 * before the lookup; clearing the client cookies is the route handler's job.
 */
export async function revokeSession(refreshTokenValue: string): Promise<void> {
  const tokenHash = await hashRefreshToken(refreshTokenValue);
  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revokedAt: new Date() }
  });
}

/** Resolves a caller's identity from a request's access-token cookie only. */
export async function getSessionFromRequest(request: Request): Promise<SessionUser | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const token = readCookie(cookieHeader, ACCESS_TOKEN_COOKIE);
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
}

export interface SessionResult {
  user: SessionUser | null;
  /** When a silent refresh happened, these cookies must be set on the response. */
  rotatedTokens?: TokenPair;
}

/**
 * Resolves a caller's identity for a protected API handler, attempting a
 * silent refresh when the access token is missing or expired (6.2/6.3).
 * Callers must apply `rotatedTokens` to their response via `setSessionCookies`
 * so the rotation is persisted client-side.
 */
export async function getSessionFromRequestWithRefresh(
  request: Request
): Promise<SessionResult> {
  const user = await getSessionFromRequest(request);
  if (user) return { user };

  const cookieHeader = request.headers.get('cookie') ?? '';
  const refreshToken = readCookie(cookieHeader, REFRESH_TOKEN_COOKIE);
  if (!refreshToken) return { user: null };

  try {
    const rotated = await rotateSession(refreshToken, request.headers.get('user-agent') ?? undefined);
    return {
      user: rotated.user,
      rotatedTokens: { accessToken: rotated.accessToken, refreshToken: rotated.refreshToken }
    };
  } catch {
    // Invalid/expired/revoked refresh token: treat as unauthenticated.
    return { user: null };
  }
}

/**
 * Reuse detection: revokes the token that was replayed and every token in its
 * rotation chain (the successor chain via `replacedByTokenId` plus all
 * predecessors that rotated into it).
 */
async function revokeTokenChain(
  tokenId: string,
  successorId: string | null
): Promise<void> {
  const now = new Date();
  const ids = new Set<string>([tokenId]);

  // Walk the successor chain (tokens this token was rotated into).
  let currentId: string | null = successorId;
  let hops = 0;
  while (currentId && !ids.has(currentId) && hops < 1000) {
    ids.add(currentId);
    const next = await prisma.refreshToken.findUnique({
      where: { id: currentId },
      select: { id: true, replacedByTokenId: true }
    });
    currentId = next?.replacedByTokenId ?? null;
    hops += 1;
  }

  // Walk predecessors (tokens that were rotated into this token). The unique
  // `replacedByTokenId` constraint guarantees at most one per step.
  let previousId = tokenId;
  hops = 0;
  while (hops < 1000) {
    const prev = await prisma.refreshToken.findFirst({
      where: { replacedByTokenId: previousId },
      select: { id: true }
    });
    if (!prev) break;
    ids.add(prev.id);
    previousId = prev.id;
    hops += 1;
  }

  if (ids.size > 0) {
    await prisma.refreshToken.updateMany({
      where: { id: { in: [...ids] } },
      data: { revokedAt: now }
    });
  }
}
