import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation';
import { authSecret } from '@/lib/auth-secret';

/**
 * NextAuth configuration for CoRide.
 *
 * Sessions use the JWT strategy (no database session table required): the
 * `jwt` callback stores the user's id and role on the token, and the `session`
 * callback exposes them back to the app as `session.user.id` / `session.user.role`.
 *
 * Sign-in is handled by the Credentials provider, which validates the email
 * against the registered user and verifies the password with bcrypt. On any
 * failure `authorize` returns `null`, which NextAuth turns into a failed login
 * (the `/login` page then surfaces a generic "invalid credentials" error).
 *
 * NOTE: `NEXTAUTH_SECRET` should be set in production. When it is absent we
 * fall back to a shared deterministic secret (`@/lib/auth-secret`) so protected
 * routes keep working in local/demo deployments and CI. The middleware uses the
 * same shared secret so it can verify the session JWT.
 */
export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        // Never expose the password hash on the session/JWT.
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    }
  }
};

/** Server-side helper: returns the current session (or `null`) using authOptions. */
export function getSession() {
  return getServerSession(authOptions);
}
