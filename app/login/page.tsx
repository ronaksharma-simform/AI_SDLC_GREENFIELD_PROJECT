import { redirect } from 'next/navigation';
import { getSession, hasValidRefreshToken } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata = {
  title: 'Sign in | CoRide'
};

/**
 * Login page guard (REQ-11 / 6.4).
 *
 * A signed-in visitor is never shown the login form:
 *   - with a valid access token they are sent straight to the dashboard;
 *   - with only a valid refresh token (expired access token) they are sent to
 *     the refresh endpoint, which rotates the session and forwards them to the
 *     dashboard — all before the auth form renders.
 */
export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getSession();
  if (user) redirect('/dashboard');

  const refreshable = await hasValidRefreshToken();
  if (refreshable) {
    const { callbackUrl } = await searchParams;
    const safeCallback =
      callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
        ? callbackUrl
        : '/dashboard';
    redirect(`/api/auth/refresh?redirectTo=${encodeURIComponent(safeCallback)}`);
  }

  return <LoginForm />;
}
