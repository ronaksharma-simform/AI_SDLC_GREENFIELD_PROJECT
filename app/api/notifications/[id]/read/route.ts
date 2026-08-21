import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { isValidUuid } from '@/lib/rides';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notifications/{id}/read
 *
 * Marks a single notification as read (NOTIF-5 / Section 11.4). Recipient-only:
 * a notification that does not exist, and a notification that belongs to
 * another user, both resolve to the same 404 (Section 10 / Section 15 —
 * Security). Idempotent — marking an already-read notification succeeds.
 *
 * Responses:
 *   - 200 { ok: true, notification }  on success
 *   - 400 { ok: false, error }        malformed notification id
 *   - 401 { ok: false, error }        no valid session
 *   - 404 { ok: false, error }        notification not found / not owned by the caller
 *   - 500 { ok: false, error }        unexpected failure
 */
export async function PATCH(_request: Request, { params }: RouteContext) {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return Response.json({ ok: false, error: 'Invalid notification ID.' }, { status: 400 });
  }

  try {
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.userId !== session.user.id) {
      return Response.json({ ok: false, error: 'Notification not found.' }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    return NextResponse.json({ ok: true, notification: updated });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Mark notification read failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
