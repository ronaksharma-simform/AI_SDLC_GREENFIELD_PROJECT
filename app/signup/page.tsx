import { redirect } from 'next/navigation';
import { getSession, hasValidRefreshToken } from '@/lib/auth';
import { SignupForm } from './signup-form';

export const metadata = {
  title: 'Sign up | CoRide'
};

/**
 * Signup page guard (6.4).
 *
 * Mirrors the login page guard: a signed-in visitor is redirected to the
 * dashboard instead of being shown the registration form, so a logged-in user
 * cannot accidentally re-register or see auth forms.
 */
export default async function SignupPage() {
  const user = await getSession();
  if (user) redirect('/dashboard');

  const refreshable = await hasValidRefreshToken();
  if (refreshable) redirect('/api/auth/refresh?redirectTo=/dashboard');

  return <SignupForm />;
}
