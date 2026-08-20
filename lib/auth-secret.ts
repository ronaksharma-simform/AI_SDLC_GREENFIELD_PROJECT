/**
 * Shared secret used to sign access-token JWTs (HS256) and verify them in the
 * Edge middleware and on the server.
 *
 * `SESSION_SECRET` takes precedence, with `NEXTAUTH_SECRET` accepted as a
 * legacy fallback for deployments that set it before the two-token session
 * model replaced NextAuth. The final fallback is deterministic so the app
 * still works in local/demo deployments and in CI where neither variable is
 * configured.
 *
 * NOTE: the fallback is NOT a production-grade secret. Deployments must set
 * `SESSION_SECRET` (or `NEXTAUTH_SECRET`) to a strong random value.
 */
export const authSecret =
  process.env.SESSION_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  'coride-dev-only-secret-change-before-production';
