import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/notifications/unread-count
 *
 * Returns the current user's unread count, used to render the bell badge
 * (Section 5). The badge is hidden entirely when the count is zero, so the
 * client hides it rather than showing "0".
 *
 * Responses:
 *   - 200 { ok: true, count }   on success
 *   - 401 { ok: false, error }  no valid session
 *   - 500 { ok: false, error }  unexpected failure
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const count = await prisma.notification.count({
      where: { userId: session.user.id, isRead: false }
    });

    return NextResponse.json({ ok: true, count });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unread notification count failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
