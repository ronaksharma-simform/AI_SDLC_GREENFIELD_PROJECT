import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken, ACCESS_TOKEN_COOKIE } from '@/lib/tokens';

/**
 * Protects the authenticated areas of the app and keeps authenticated users
 * away from the auth pages.
 *
 * Access-token logic (REQ-11 / REQ-12):
 *   - If the `access_token` cookie is present AND its signature/expiry verify:
 *       - `/login` and `/signup` are redirected straight to `/dashboard` — the
 *         auth form is never shown to a signed-in user.
 *       - `/dashboard` (protected) is allowed through.
 *   - Otherwise (no access token, or it expired / failed verification):
 *       - `/dashboard` is redirected to `/login`, carrying the original
 *         destination as `callbackUrl` so the user lands back on it after
 *         signing in.
 *       - `/login` / `/signup` render normally (the page's own server-side
 *         guard handles the case where only a refresh token remains).
 *
 * The refresh-token-only case (expired access token + valid refresh cookie)
 * cannot be resolved here because the Edge runtime has no database access; the
 * login page guard silently renews those sessions server-side and sends them
 * on to the dashboard.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const isAuthenticated = accessToken ? (await verifyAccessToken(accessToken)) !== null : false;

  const isAuthPage = pathname === '/login' || pathname === '/signup';
  const isProtected = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  if (isAuthenticated) {
    if (isAuthPage) {
      const dashboard = request.nextUrl.clone();
      dashboard.pathname = '/dashboard';
      dashboard.search = '';
      return NextResponse.redirect(dashboard);
    }
    return NextResponse.next();
  }

  if (isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup']
};
