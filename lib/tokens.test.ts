import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  readCookie,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS
} from '@/lib/tokens';
import { authSecret } from '@/lib/auth-secret';

const user = { id: 'user-1', role: 'DRIVER', email: 'driver@example.com', name: 'Ada' };

const encoder = new TextEncoder();

describe('access tokens (sign / verify)', () => {
  it('round-trips a signed access token with the user claims', async () => {
    const token = await signAccessToken(user);
    const payload = await verifyAccessToken(token);
    expect(payload).toEqual({
      sub: 'user-1',
      role: 'DRIVER',
      email: 'driver@example.com',
      name: 'Ada'
    });
  });

  it('returns null for a token with a tampered signature', async () => {
    const token = await signAccessToken(user);
    const parts = token.split('.');
    const sig = parts[2];
    // Flip a character well inside the signature (not the trailing padding bits,
    // which some decoders ignore and would leave the signature unchanged).
    const flipped = sig[5] === 'A' ? 'B' : 'A';
    const tampered = `${parts[0]}.${parts[1]}.${sig.slice(0, 5)}${flipped}${sig.slice(6)}`;
    await expect(verifyAccessToken(tampered)).resolves.toBeNull();
  });

  it('returns null for a token signed with a different secret', async () => {
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('x')
      .sign(encoder.encode('some-other-secret'));
    await expect(verifyAccessToken(foreign)).resolves.toBeNull();
  });

  it('returns null for an expired token', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('x')
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(encoder.encode(authSecret));
    await expect(verifyAccessToken(expired)).resolves.toBeNull();
  });

  it('exposes a 15-minute access-token TTL', () => {
    expect(ACCESS_TOKEN_TTL_SECONDS).toBe(15 * 60);
  });
});

describe('refresh token primitives', () => {
  it('generates a base64url 256-bit token and hashes it to 64 hex chars', async () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const hash = await hashRefreshToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Hashing is deterministic.
    expect(await hashRefreshToken(token)).toBe(hash);
  });

  it('generates unique refresh tokens', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
  });

  it('exposes a 7-day refresh-token TTL', () => {
    expect(REFRESH_TOKEN_TTL_SECONDS).toBe(7 * 24 * 60 * 60);
  });
});

describe('cookie names / parsing', () => {
  it('exports the documented cookie names', () => {
    expect(ACCESS_TOKEN_COOKIE).toBe('access_token');
    expect(REFRESH_TOKEN_COOKIE).toBe('refresh_token');
  });

  it('reads a cookie value from a raw Cookie header', () => {
    const header = `${ACCESS_TOKEN_COOKIE}=abc; ${REFRESH_TOKEN_COOKIE}=xyz`;
    expect(readCookie(header, REFRESH_TOKEN_COOKIE)).toBe('xyz');
    expect(readCookie(header, ACCESS_TOKEN_COOKIE)).toBe('abc');
  });

  it('returns null for a missing cookie', () => {
    expect(readCookie('access_token=abc', 'refresh_token')).toBeNull();
    expect(readCookie('', 'access_token')).toBeNull();
  });
});
