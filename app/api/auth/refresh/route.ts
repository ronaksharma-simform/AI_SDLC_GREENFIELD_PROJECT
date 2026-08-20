import { NextResponse } from 'next/server';
import {
  rotateSession,
  setSessionCookies,
  clearSessionCookies,
  TokenError
} from '@/lib/session';
import { readCookie, REFRESH_TOKEN_COOKIE } from '@/lib/tokens';

/**
 * POST/GET /api/auth/refresh
 *
 * Exchanges a valid refresh token (sent as the HttpOnly `refresh_token`
 * cookie) for a fresh access + refresh token pair. The refresh token is
 * rotated on every use (REQ-8): the presented token is invalidated and linked
 * to its replacement. Reuse of an already-rotated/revoked token revokes the
 * entire session chain (REQ-9).
 *
 * POST is the API-call form (returns JSON). GET is used as an internal
 * redirect target by the login/signup page guards so a visitor whose access
 * token expired but still holds a valid refresh token is silently renewed and
 * sent to `redirectTo` without ever seeing the auth form.
 *
 * Responses:
 *   - 200 { ok: true, user }              on success; sets new session cookies
 *   - 307 redirect (GET with redirectTo)  on success for the page-guard flow
 *   - 401 { ok: false, error }            missing/invalid/expired/reused refresh token
 *   - 500 { ok: false, error }            unexpected failure
 */
export async function POST(request: Request) {
  return handleRefresh(request);
}

export async function GET(request: Request) {
  return handleRefresh(request);
}

async function handleRefresh(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const refreshToken = readCookie(cookieHeader, REFRESH_TOKEN_COOKIE);

  if (!refreshToken) {
    return NextResponse.json(
      { ok: false, error: 'Missing refresh token.' },
      { status: 401 }
    );
  }

  try {
    const rotated = await rotateSession(refreshToken, request.headers.get('user-agent') ?? undefined);

    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo');
    if (redirectTo) {
      const safeTarget = sanitizeRedirectPath(redirectTo);
      const response = NextResponse.redirect(new URL(safeTarget, url.origin));
      setSessionCookies(response, rotated);
      return response;
    }

    const response = NextResponse.json(
      { ok: true, user: rotated.user },
      { status: 200 }
    );
    setSessionCookies(response, rotated);
    return response;
  } catch (error) {
    if (error instanceof TokenError) {
      const response = NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status }
      );
      clearSessionCookies(response);
      return response;
    }

    // eslint-disable-next-line no-console
    console.error('Token refresh failed:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * Restricts refresh redirects to same-origin relative paths so the endpoint
 * cannot be abused as an open redirector.
 */
function sanitizeRedirectPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}
