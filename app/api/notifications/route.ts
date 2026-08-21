import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/notifications
 *
 * Lists the current user's notifications, most recent first (Section 13).
 * Access is scoped to the requesting user — notifications belonging to anyone
 * else are never returned (Section 15 — Security).
 *
 * Responses:
 *   - 200 { ok: true, notifications }  on success
 *   - 401 { ok: false, error }         no valid session
 *   - 500 { ok: false, error }         unexpected failure
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      include: {
        relatedRide: {
          select: {
            id: true,
            sourceAddress: true,
            destinationAddress: true,
            departureTime: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Notification listing failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 *
 * Marks every unread notification belonging to the current user as read in one
 * operation (NOTIF-5 / Section 11.4). Only the caller's own notifications are
 * touched (Section 15 — Security).
 *
 * Responses:
 *   - 200 { ok: true, count }          number of notifications marked read
 *   - 401 { ok: false, error }         no valid session
 *   - 500 { ok: false, error }         unexpected failure
 */
export async function PATCH() {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true }
    });

    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Mark-all-read failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
