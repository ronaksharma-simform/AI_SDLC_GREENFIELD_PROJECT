import { NextResponse } from 'next/server';
import { revokeSession, clearSessionCookies } from '@/lib/session';
import { readCookie, REFRESH_TOKEN_COOKIE } from '@/lib/tokens';

/**
 * POST /api/auth/logout
 *
 * Revokes the current refresh token server-side (REQ-10) and clears both
 * session cookies. Revoking server-side means a copied refresh token cannot be
 * reused elsewhere even after the client clears its cookies.
 *
 * Responses:
 *   - 200 { ok: true }   on success (always; even without a refresh cookie)
 *   - 500 { ok: false, error }   unexpected failure
 */
export async function POST(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const refreshToken = readCookie(cookieHeader, REFRESH_TOKEN_COOKIE);

  try {
    if (refreshToken) {
      await revokeSession(refreshToken);
    }

    const response = NextResponse.json({ ok: true }, { status: 200 });
    clearSessionCookies(response);
    return response;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Logout failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
