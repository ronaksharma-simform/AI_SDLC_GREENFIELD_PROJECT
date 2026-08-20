import { DefaultSession } from 'next-auth';

/**
 * Type augmentation for NextAuth.
 *
 * The credentials provider returns the user's Prisma id and role, and the JWT
 * session callbacks copy them onto the token/session. Augmenting the module
 * interfaces makes those fields visible (and typed) to the rest of the app,
 * e.g. `session.user.id` and `session.user.role` on the dashboard page.
 */
declare module 'next-auth' {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id?: string;
      role?: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}
