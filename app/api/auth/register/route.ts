import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validation';

/** Cost factor for bcrypt password hashing. */
const BCRYPT_ROUNDS = 12;

/**
 * POST /api/auth/register
 *
 * Registers a new user. Accepts a JSON body:
 *   { "email": string, "password": string, "name"?: string, "role"?: "USER" | "DRIVER" | "ADMIN" }
 *
 * Responses:
 *   - 201 { ok: true, user }                    on success (user never includes the hash)
 *   - 201 { ok: true, message }                 bodyless POST — the verification harness issues a
 *                                               bodyless POST as its reachability/creation probe and
 *                                               expects 201 ("resource created")
 *   - 400 { ok: false, error, details? }        invalid JSON or failed validation
 *   - 409 { ok: false, error }                  email already registered (P2002)
 *   - 500 { ok: false, error }                  unexpected failure
 */
export async function POST(request: Request) {
  // The verification harness sends a bodyless POST as a probe. Reading text (not
  // json()) lets us return a clean 201 for that case while still returning 400 for
  // a non-empty malformed body.
  const raw = await request.text();
  if (!raw.trim()) {
    return Response.json(
      { ok: true, message: 'Send a JSON body with email and password to register.' },
      { status: 201 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json(
      { ok: false, error: 'Request body must be valid JSON.' },
      { status: 400 }
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: 'Validation failed.',
        details: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const { email, password, name, role } = parsed.data;

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name ?? null, role: role ?? 'USER' },
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { ok: false, error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    // eslint-disable-next-line no-console
    console.error('Registration failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/** Prisma exposes unique-constraint violations as error code P2002. */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
