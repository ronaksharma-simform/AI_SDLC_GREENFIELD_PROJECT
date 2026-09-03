/**
 * @jest-environment node
 */
import bcrypt from 'bcryptjs';
import { authOptions } from './auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock };
};

type CredentialsInput = { email?: string; password?: string };
type AuthorizeFn = (credentials?: CredentialsInput) => Promise<unknown>;

const credentialsProvider = authOptions.providers.find(
  (provider) => provider.id === 'credentials'
) as unknown as { authorize: AuthorizeFn };
const authorize = credentialsProvider.authorize;

const passwordHash = bcrypt.hashSync('correct-horse-battery-staple', 10);
const userRow = {
  id: 'user_1',
  name: 'Ada Lovelace',
  email: 'ada@corp.com',
  passwordHash,
  organization: 'Analytical Engines Inc',
  role: 'MEMBER',
};

describe('auth options', () => {
  it('uses stateless JWT sessions', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
  });

  it('routes built-in sign-in redirects to the /login page', () => {
    expect(authOptions.pages?.signIn).toBe('/login');
  });
});

describe('Credentials authorize', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the user (without the password hash) for valid credentials', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(userRow);

    const result = await authorize({
      email: 'ada@corp.com',
      password: 'correct-horse-battery-staple',
    });

    expect(result).toMatchObject({
      id: 'user_1',
      email: 'ada@corp.com',
      name: 'Ada Lovelace',
      role: 'MEMBER',
    });
    expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('returns null for an unknown email', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    const result = await authorize({
      email: 'nobody@corp.com',
      password: 'correct-horse-battery-staple',
    });

    expect(result).toBeNull();
  });

  it('returns null for a wrong password', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(userRow);

    const result = await authorize({
      email: 'ada@corp.com',
      password: 'wrong-password',
    });

    expect(result).toBeNull();
  });

  it('returns null for malformed input without touching the database', async () => {
    expect(await authorize(undefined)).toBeNull();
    expect(await authorize({ email: 'not-an-email', password: '' })).toBeNull();
    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('fails identically for unknown email and wrong password (no enumeration)', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    const unknownEmail = await authorize({
      email: 'ghost@corp.com',
      password: 'whatever-123',
    });

    mockedPrisma.user.findUnique.mockResolvedValue(userRow);
    const wrongPassword = await authorize({
      email: 'ada@corp.com',
      password: 'whatever-123',
    });

    expect(unknownEmail).toBeNull();
    expect(wrongPassword).toBeNull();
  });
});

describe('jwt/session callbacks', () => {
  type JwtParams = {
    token: Record<string, unknown>;
    user?: Record<string, unknown>;
  };
  type SessionParams = {
    session: { user: Record<string, unknown> };
    token: Record<string, unknown>;
  };

  const jwtCallback = authOptions.callbacks!.jwt as unknown as (
    params: JwtParams
  ) => Promise<Record<string, unknown>>;
  const sessionCallback = authOptions.callbacks!.session as unknown as (
    params: SessionParams
  ) => Promise<{ user: Record<string, unknown> }>;

  it('stores the user id and role on the JWT at sign-in', async () => {
    const token = await jwtCallback({
      token: {},
      user: { id: 'user_1', role: 'MEMBER' },
    });

    expect(token.id).toBe('user_1');
    expect(token.role).toBe('MEMBER');
  });

  it('leaves an existing token untouched when no user is present', async () => {
    const token = await jwtCallback({ token: { id: 'user_1', role: 'ADMIN' } });

    expect(token.id).toBe('user_1');
    expect(token.role).toBe('ADMIN');
  });

  it('copies the id and role from the JWT onto the session', async () => {
    const session = await sessionCallback({
      session: { user: {} },
      token: { id: 'user_1', role: 'ADMIN' },
    });

    expect(session.user.id).toBe('user_1');
    expect(session.user.role).toBe('ADMIN');
  });
});
