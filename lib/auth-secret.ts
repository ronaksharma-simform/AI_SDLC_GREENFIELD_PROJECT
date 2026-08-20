/**
 * Shared NextAuth secret used by both the server (getServerSession / authOptions)
 * and the Edge middleware (withAuth) so the session JWT is signed and verified
 * with the same key.
 *
 * `NEXTAUTH_SECRET` takes precedence when set. The fallback is deterministic so
 * the app still works in local/demo deployments and in CI where the variable is
 * not configured — without it, NextAuth v4 refuses to run in production mode and
 * every protected page redirects to `/api/auth/error?error=Configuration`.
 *
 * NOTE: the fallback is NOT a production-grade secret. Deployments must set
 * `NEXTAUTH_SECRET` to a strong random value.
 */
export const authSecret =
  process.env.NEXTAUTH_SECRET ?? 'coride-dev-only-secret-change-before-production';
