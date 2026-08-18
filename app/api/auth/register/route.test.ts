/**
 * @jest-environment node
 */
import { POST } from './route';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock };
};

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  name: 'Ada Lovelace',
  email: 'ada@corp.com',
  password: 'password123',
  organization: 'Analytical Engines Inc',
};

describe('POST /api/auth/register', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a user and returns 201 without leaking the password hash', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'user_1',
      role: 'MEMBER',
      ...data,
    }));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.email).toBe('ada@corp.com');
    expect(json.organization).toBe('Analytical Engines Inc');
    expect(json.passwordHash).toBeUndefined();
  });

  it('hashes the password with bcrypt before persisting', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);
    mockedPrisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'user_1',
      role: 'MEMBER',
      ...data,
    }));

    await POST(makeRequest(validBody));

    const createArg = mockedPrisma.user.create.mock.calls[0][0];
    const storedHash = createArg.data.passwordHash as string;
    expect(storedHash).not.toBe(validBody.password);
    expect(await bcrypt.compare(validBody.password, storedHash)).toBe(true);
  });

  it('returns 409 when the email is already registered', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'ada@corp.com' });

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
    expect(mockedPrisma.user.create).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid input', async () => {
    const res = await POST(
      makeRequest({ name: '', email: 'not-an-email', password: 'short', organization: '' })
    );
    expect(res.status).toBe(400);
    expect(mockedPrisma.user.create).not.toHaveBeenCalled();
  });
});
