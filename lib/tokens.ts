import { SignJWT, jwtVerify } from 'jose';
import { authSecret } from '@/lib/auth-secret';

/**
 * Token primitives for the two-token session model.
 *
 * This module is intentionally edge-safe: it uses only the Web Crypto API
 * (`crypto.subtle`, `crypto.getRandomValues`) and `jose`, so it can be
 * imported by the Edge middleware as well as Node route handlers. It performs
 * NO database access.
 *
 * Access tokens are short-lived, signed, stateless JWTs (HS256) — verified by
 * signature and expiry only, never stored in the database. Refresh tokens are
 * opaque 256-bit random values whose SHA-256 hash is stored server-side.
 */

/** Access token lifetime: 15 minutes. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh token lifetime: 7 days. */
export const REFRESH_TOKEN_TTL_DAYS = 7;
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60;

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** Claims carried by the (stateless) access token. */
export interface AccessTokenPayload {
  /** User id (JWT `sub`). */
  sub: string;
  role: string;
  email: string;
  name: string | null;
}

const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  return encoder.encode(authSecret);
}

/**
 * Signs a short-lived access token for the given user. The token carries the
 * user's role/email/name so server-rendered pages and API handlers can trust
 * them without a database lookup for the lifetime of the token.
 */
export async function signAccessToken(user: {
  id: string;
  role: string;
  email: string;
  name: string | null;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: user.role, email: user.email, name: user.name ?? '' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL_SECONDS)
    .sign(secretKey());
}

/**
 * Verifies an access token's signature and expiry. Returns the decoded claims
 * on success, or `null` when the token is missing, malformed, expired, or has
 * an invalid signature.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      role: (payload.role as string | undefined) ?? 'USER',
      email: (payload.email as string | undefined) ?? '',
      name: (payload.name as string | undefined) || null
    };
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically random refresh token (256 bits) encoded as
 * base64url. The raw value is returned to the client as an HttpOnly cookie;
 * only its hash is stored in the database.
 */
export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let result = '';
  for (const byte of bytes) {
    result += String.fromCharCode(byte);
  }
  return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Hashes a refresh token with SHA-256 (hex). Storing only the hash means a
 * database leak does not expose usable tokens, the same way passwords are
 * stored. `crypto.subtle` is available on both Node and Edge.
 */
export async function hashRefreshToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Computes the expiry timestamp for a newly issued refresh token. */
export function refreshTokenExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

/** Reads a cookie value from a raw `Cookie` request header (or `''`). */
export function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}
