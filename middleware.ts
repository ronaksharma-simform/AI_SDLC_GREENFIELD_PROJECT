import { withAuth } from 'next-auth/middleware';
import { authSecret } from '@/lib/auth-secret';

/**
 * Protects the authenticated areas of the app.
 *
 * `withAuth` redirects unauthenticated visitors to the configured sign-in page
 * (`/login`) and carries the original destination through as `callbackUrl` so
 * the login page can send them back afterwards.
 *
 * The matcher keeps the middleware off public pages and static assets.
 *
 * `/vehicles/new` is intentionally public so the form can render; vehicle
 * creation itself is gated by `POST /api/vehicles`, which returns 401 without
 * a valid session. The edit page (`/vehicles/[id]/edit`) is likewise public so
 * the form can render; ownership is enforced by `GET/PATCH /api/vehicles/[id]`.
 * Any future `/vehicles` pages that must be private should be added back to the
 * matcher.
 */
export default withAuth({
  secret: authSecret,
  pages: {
    signIn: '/login'
  }
});

export const config = {
  matcher: ['/dashboard/:path*']
};
