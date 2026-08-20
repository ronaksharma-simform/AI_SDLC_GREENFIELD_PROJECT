import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { store, User } from './store';

const SCRYPT_KEYLEN = 64;
const SESSION_COOKIE = 'sid';

/** Hash a plaintext password using scrypt with a random per-user salt. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Request type extended with the authenticated user (set by `requireAuth`). */
export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Express middleware guarding protected routes.
 * Resolves the session cookie → user, or responds 401 when the caller is
 * unauthenticated or holds an invalid/expired session.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = (req.cookies && (req.cookies[SESSION_COOKIE] as string | undefined)) || undefined;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const session = store.findSession(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  const user = store.findUserById(session.userId);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.user = user;
  next();
}

/** The safe, serializable representation of a user (never includes the hash). */
export function publicUser(user: User): { id: string; email: string; createdAt: Date } {
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
