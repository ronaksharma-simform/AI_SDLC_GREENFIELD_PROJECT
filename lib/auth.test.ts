import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories can reference them (vitest hoists the mock
// calls above imports; vi.hoisted avoids temporal-dead-zone surprises).
const { mockCompare, mockFindUnique } = vi.hoisted(() => ({
  mockCompare: vi.fn(),
  mockFindUnique: vi.fn()
}));

vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: mockCompare }
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique
    }
  }
}));

// Return the provider options object unchanged so we can reach `authorize`
// directly in the tests (the real CredentialsProvider wraps it with NextAuth
// plumbing we do not exercise here).
vi.mock('next-auth/providers/credentials', () => ({
  __esModule: true,
  default: (options: unknown) => options
}));

import { authOptions } from '@/lib/auth';

const dbUser = {
  id: '9b2f2f9e-2f2f-4f2f-9f2f-2f2f2f2f2f2f',
  email: 'driver@example.com',
  passwordHash: '$2a$12$abcdefghijklmnopqrstuv',
  name: 'Ada',
  role: 'DRIVER'
};

type CredentialsProviderConfig = {
  authorize?: (credentials?: unknown) => Promise<unknown>;
};

const authorize = (authOptions.providers[0] as CredentialsProviderConfig).authorize!;

describe('authOptions (NextAuth credentials + JWT session)', () => {
  beforeEach(() => {
    mockCompare.mockReset();
    mockFindUnique.mockReset();
  });

  it('configures the JWT session strategy and the /login sign-in page', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
    expect(authOptions.pages?.signIn).toBe('/login');
  });

  it('registers a credentials provider with an authorize function', () => {
    expect(authOptions.providers).toHaveLength(1);
    expect(typeof authorize).toBe('function');
  });

  it('authorize returns the user (without the password hash) for valid credentials', async () => {
    mockFindUnique.mockResolvedValue(dbUser);
    mockCompare.mockResolvedValue(true);

    const user = await authorize({ email: 'Driver@Example.com ', password: 'password123' });

    expect(user).toEqual({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role
    });
    // Email is canonicalised before the lookup; password is compared via bcrypt.
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { email: 'driver@example.com' } });
    expect(mockCompare).toHaveBeenCalledWith('password123', dbUser.passwordHash);
  });

  it('authorize returns null when the password does not match', async () => {
    mockFindUnique.mockResolvedValue(dbUser);
    mockCompare.mockResolvedValue(false);

    await expect(authorize({ email: 'driver@example.com', password: 'wrong' })).resolves.toBeNull();
  });

  it('authorize returns null when no user exists for the email', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(authorize({ email: 'ghost@example.com', password: 'password123' })).resolves.toBeNull();
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it('authorize returns null for invalid credentials input', async () => {
    await expect(authorize({ email: 'not-an-email', password: 'password123' })).resolves.toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('jwt callback stores the user id and role on the token', async () => {
    const callback = authOptions.callbacks?.jwt;
    const token = await callback?.({ token: {}, user: { id: dbUser.id, role: 'DRIVER' } });

    expect(token?.id).toBe(dbUser.id);
    expect(token?.role).toBe('DRIVER');
  });

  it('session callback exposes id and role from the token', async () => {
    const callback = authOptions.callbacks?.session;
    const session = await callback?.({ session: { user: {} }, token: { id: dbUser.id, role: 'DRIVER' } });

    expect(session?.user?.id).toBe(dbUser.id);
    expect(session?.user?.role).toBe('DRIVER');
  });
});
