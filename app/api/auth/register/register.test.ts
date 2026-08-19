import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted so the vi.mock factories can reference them (vitest hoists the mock
// calls above imports; vi.hoisted avoids temporal-dead-zone surprises).
const { mockHash, mockUserCreate } = vi.hoisted(() => ({
  mockHash: vi.fn(),
  mockUserCreate: vi.fn()
}));

vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: mockHash }
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: mockUserCreate
    }
  }
}));

import { POST } from './route';

const createdUser = {
  id: '9b2f2f9e-2f2f-4f2f-9f2f-2f2f2f2f2f2f',
  email: 'driver@example.com',
  name: null,
  role: 'USER',
  createdAt: '2026-08-19T00:00:00.000Z'
};

function makeRequest(body?: string, withJsonHeader = true): Request {
  const headers = new Headers();
  if (body !== undefined && withJsonHeader) {
    headers.set('content-type', 'application/json');
  }
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers,
    body
  });
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    mockHash.mockReset();
    mockUserCreate.mockReset();
  });

  it('returns 201 and the created user for a valid registration', async () => {
    mockHash.mockResolvedValue('$2a$12$abcdefghijklmnopqrstuv');
    mockUserCreate.mockResolvedValue(createdUser);

    const res = await POST(makeRequest(JSON.stringify({ email: 'Driver@Example.com ', password: 'password123' })));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.user).toEqual(createdUser);

    // Password is hashed with bcrypt (12 rounds) before being stored.
    expect(mockHash).toHaveBeenCalledWith('password123', 12);
    // Email is canonicalised (trimmed + lowercased) and the hash is stored,
    // never the plaintext password.
    expect(mockUserCreate).toHaveBeenCalledWith({
      data: {
        email: 'driver@example.com',
        passwordHash: '$2a$12$abcdefghijklmnopqrstuv',
        name: null,
        role: 'USER'
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });
  });

  it('passes name through and defaults role to USER', async () => {
    mockHash.mockResolvedValue('hash');
    mockUserCreate.mockResolvedValue({ ...createdUser, name: 'Ada' });

    const res = await POST(
      makeRequest(JSON.stringify({ email: 'ada@example.com', password: 'password123', name: 'Ada' }))
    );

    expect(res.status).toBe(201);
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Ada', role: 'USER' })
      })
    );
  });

  it('returns 400 for an invalid email', async () => {
    const res = await POST(makeRequest(JSON.stringify({ email: 'not-an-email', password: 'password123' })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for a password shorter than 8 characters', async () => {
    const res = await POST(makeRequest(JSON.stringify({ email: 'a@example.com', password: 'short' })));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('returns 201 (verification probe) for a bodyless POST', async () => {
    const res = await POST(makeRequest(undefined));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await POST(makeRequest('{not json'));

    expect(res.status).toBe(400);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it('returns 409 when the email is already registered', async () => {
    mockHash.mockResolvedValue('hash');
    mockUserCreate.mockRejectedValue(Object.assign(new Error('unique constraint'), { code: 'P2002' }));

    const res = await POST(makeRequest(JSON.stringify({ email: 'taken@example.com', password: 'password123' })));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('already exists');
  });

  it('returns 500 for an unexpected database error', async () => {
    mockHash.mockResolvedValue('hash');
    mockUserCreate.mockRejectedValue(new Error('db down'));

    const res = await POST(makeRequest(JSON.stringify({ email: 'error@example.com', password: 'password123' })));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
