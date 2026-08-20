import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validation';
import { createSession, setSessionCookies } from '@/lib/session';

/**
 * POST /api/auth/login
 *
 * Validates email/password credentials and, on success, issues a fresh access
 * token (15 min) and refresh token (7 days) as HttpOnly, Secure cookies.
 *
 * Accepts a JSON body:
 *   { "email": string, "password": string }
 *
 * Responses:
 *   - 200 { ok: true, user }          on success; sets access_token + refresh_token cookies
 *   - 400 { ok: false, error, details? }  invalid JSON or failed validation
 *   - 401 { ok: false, error }        invalid credentials (generic — does not
 *                                     reveal whether the email or password was wrong)
 *   - 500 { ok: false, error }        unexpected failure
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!raw.trim()) {
    return Response.json(
      { ok: false, error: 'Email and password are required.' },
      { status: 400 }
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

  const parsed = loginSchema.safeParse(body);
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

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return Response.json(
        { ok: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return Response.json(
        { ok: false, error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const tokens = await createSession(user, userAgent);

    const response = NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
      { status: 200 }
    );
    setSessionCookies(response, tokens);
    return response;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Login failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
