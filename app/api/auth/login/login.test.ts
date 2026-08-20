import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCompare, mockUserFindUnique, mockRefreshCreate } = vi.hoisted(() => ({
  mockCompare: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockRefreshCreate: vi.fn()
}));

vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: mockCompare }
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    refreshToken: { create: mockRefreshCreate }
  }
}));

import { POST } from './route';

const dbUser = {
  id: '9b2f2f9e-2f2f-4f2f-9f2f-2f2f2f2f2f2f',
  email: 'driver@example.com',
  passwordHash: '$2a$12$abcdefghijklmnopqrstuv',
  name: 'Ada',
  role: 'DRIVER',
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z'
};

function makeRequest(body?: string): Request {
  const headers = new Headers({ 'user-agent': 'vitest' });
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers,
    body
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mockCompare.mockReset();
    mockUserFindUnique.mockReset();
    mockRefreshCreate.mockReset();
  });

  it('returns 200 and sets HttpOnly session cookies for valid credentials', async () => {
    mockUserFindUnique.mockResolvedValue(dbUser);
    mockCompare.mockResolvedValue(true);
    mockRefreshCreate.mockResolvedValue({ id: 'rt-1' });

    const res = await POST(
      makeRequest(JSON.stringify({ email: 'Driver@Example.com ', password: 'password123' }))
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user).toEqual({ id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role });

    // Email canonicalised before lookup.
    expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { email: 'driver@example.com' } });
    expect(mockCompare).toHaveBeenCalledWith('password123', dbUser.passwordHash);

    // Both tokens delivered as cookies.
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);
  });

  it('returns a generic 401 when the password does not match', async () => {
    mockUserFindUnique.mockResolvedValue(dbUser);
    mockCompare.mockResolvedValue(false);

    const res = await POST(makeRequest(JSON.stringify({ email: 'driver@example.com', password: 'wrong' })));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid email or password');
    expect(mockRefreshCreate).not.toHaveBeenCalled();
  });

  it('returns a generic 401 when no user exists (does not reveal which field was wrong)', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest(JSON.stringify({ email: 'ghost@example.com', password: 'password123' })));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid email or password');
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid credentials input', async () => {
    const res = await POST(makeRequest(JSON.stringify({ email: 'not-an-email', password: '' })));

    expect(res.status).toBe(400);
    expect(mockUserFindUnique).not.toHaveBeenCalled();
  });

  it('returns 400 for a bodyless POST', async () => {
    const res = await POST(makeRequest(undefined));
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeRequest('{not json'));
    expect(res.status).toBe(400);
  });

  it('returns 500 for an unexpected database error', async () => {
    mockUserFindUnique.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest(JSON.stringify({ email: 'a@example.com', password: 'password123' })));

    expect(res.status).toBe(500);
  });
});
