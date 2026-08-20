import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyAccessToken, hashRefreshToken, readCookie, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/tokens';
import type { SessionUser } from '@/lib/session';

/**
 * Server-side session helpers for the two-token model.
 *
 * Pages (server components) import `getSession` / `hasValidRefreshToken` from
 * here. Route handlers should use the request-based helpers in `@/lib/session`
 * instead.
 *
 * Access tokens are verified statelessly (signature + expiry). Because server
 * components cannot set response cookies, the "silent refresh" case on pages
 * is handled by redirecting to `POST/GET /api/auth/refresh` (see the login
 * page guard) rather than by rotating here.
 */

export type { SessionUser } from '@/lib/session';
export { setSessionCookies, clearSessionCookies, createSession, rotateSession, revokeSession, TokenError } from '@/lib/session';

/** Resolves the current user from the access-token cookie, or `null`. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
}

/**
 * Checks whether a valid, unexpired, unrotated refresh token exists for the
 * current request — i.e. the visitor can be silently renewed. Used by the
 * login/signup page guards to bounce an already-authenticated user to the
 * dashboard before the auth form renders (REQ-11).
 */
export async function hasValidRefreshToken(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!token) return false;

  const tokenHash = await hashRefreshToken(token);
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!record) return false;
  if (record.revokedAt !== null || record.replacedByTokenId !== null) return false;
  return record.expiresAt > new Date();
}

/** Reads a raw cookie header helper (kept for parity with lib/tokens). */
export function parseCookie(header: string, name: string): string | null {
  return readCookie(header, name);
}
