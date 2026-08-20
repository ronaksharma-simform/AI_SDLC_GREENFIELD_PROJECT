import { NextResponse } from 'next/server';
import {
  getSessionFromRequest,
  rotateSession,
  setSessionCookies,
  clearSessionCookies,
  TokenError
} from '@/lib/session';
import { readCookie, REFRESH_TOKEN_COOKIE } from '@/lib/tokens';

/**
 * GET /api/auth/session
 *
 * Reports the current authentication state. Used by client-side guards and
 * diagnostics. If the access token is valid it returns the user immediately.
 * If the access token is missing/expired but a valid refresh token exists, it
 * silently renews the session (sets fresh cookies) and returns the user — so
 * the client can keep the user signed in without a round-trip to the login
 * form.
 *
 * Responses:
 *   - 200 { ok: true, authenticated: true, user }    session present (possibly renewed)
 *   - 200 { ok: true, authenticated: false, user: null }  no session
 *   - 500 { ok: false, error }                       unexpected failure
 */
export async function GET(request: Request) {
  try {
    const user = await getSessionFromRequest(request);
    if (user) {
      return NextResponse.json({ ok: true, authenticated: true, user }, { status: 200 });
    }

    const cookieHeader = request.headers.get('cookie') ?? '';
    const refreshToken = readCookie(cookieHeader, REFRESH_TOKEN_COOKIE);
    if (refreshToken) {
      try {
        const rotated = await rotateSession(refreshToken, request.headers.get('user-agent') ?? undefined);
        const response = NextResponse.json(
          { ok: true, authenticated: true, user: rotated.user },
          { status: 200 }
        );
        setSessionCookies(response, rotated);
        return response;
      } catch (error) {
        if (error instanceof TokenError) {
          const response = NextResponse.json(
            { ok: true, authenticated: false, user: null },
            { status: 200 }
          );
          clearSessionCookies(response);
          return response;
        }
        throw error;
      }
    }

    return NextResponse.json({ ok: true, authenticated: false, user: null }, { status: 200 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Session lookup failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
