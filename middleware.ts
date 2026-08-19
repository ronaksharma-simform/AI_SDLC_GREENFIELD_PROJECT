import { withAuth } from 'next-auth/middleware';

/**
 * Protects the authenticated areas of the app.
 *
 * `withAuth` redirects unauthenticated visitors to the configured sign-in page
 * (`/login`) and carries the original destination through as `callbackUrl` so
 * the login page can send them back afterwards.
 *
 * The matcher keeps the middleware off public pages and static assets, and it
 * also runs for the not-yet-built `/vehicles` section so that route is locked
 * down as soon as it exists.
 */
export default withAuth({
  pages: {
    signIn: '/login'
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/vehicles/:path*']
};
