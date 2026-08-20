import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * NextAuth route handler.
 *
 * Mounts the full auth API (sign-in callback, session, sign-out, etc.) at
 * `/api/auth/*`. Exposing the same handler for GET and POST is the standard
 * NextAuth App Router pattern.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
