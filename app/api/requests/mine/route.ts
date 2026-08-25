import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/requests/mine
 *
 * Seeker-facing: lists the requests the signed-in user has sent, with their
 * current status, across all rides (Section 6.5 / Section 10). Each entry
 * includes the ride it targets so the Seeker can see route / departure context.
 *
 * Responses:
 *   - 200 { ok: true, requests }   on success
 *   - 401 { ok: false, error }     no valid session
 *   - 500 { ok: false, error }     unexpected failure
 */
export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const requests = await prisma.rideRequest.findMany({
      where: { seekerId: session.user.id },
      include: {
        ride: {
          include: {
            vehicle: true,
            provider: { select: { id: true, name: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ ok: true, requests });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('My ride requests listing failed:', error);
    return Response.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
