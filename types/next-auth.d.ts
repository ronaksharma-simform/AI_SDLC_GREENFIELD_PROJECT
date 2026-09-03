import type { DefaultSession } from 'next-auth';
import type { Role } from '@prisma/client';

declare module 'next-auth' {
  /**
   * Extend the session surfaced to server components / API routes with the
   * fields CoRide relies on for authorization.
   */
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  /**
   * The user returned by the Credentials `authorize` callback always carries
   * the persisted role.
   */
  interface User {
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  /**
   * The JWT minted at sign-in stores the user id and role; the `session`
   * callback copies them onto the session object.
   */
  interface JWT {
    id: string;
    role: Role;
  }
}
