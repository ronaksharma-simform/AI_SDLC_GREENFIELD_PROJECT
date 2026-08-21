import { NextResponse } from 'next/server';
import { processTripReminders } from '@/lib/reminders';

/**
 * GET /api/cron/trip-reminders
 *
 * HTTP entry point for the scheduled Trip Reminder job (NOTIF-3 / NOTIF-8).
 *
 * Nothing "happens" to trigger a reminder other than time passing, so an
 * external scheduler calls this endpoint on a fixed interval (every 1–2
 * minutes): a GitHub Actions cron, Vercel Cron, or a crontab `curl` all work.
 * The job runs with system-level access (Section 15) because it scans across
 * all rides; the notifications it creates are still scoped per-recipient
 * exactly like the event-driven ones.
 *
 * Security: guarded by the `x-cron-secret` header, which must equal the
 * `CRON_SECRET` environment variable. When `CRON_SECRET` is not configured the
 * endpoint is disabled (503) so it cannot be left accidentally open.
 *
 * Responses:
 *   - 200 { ok: true, ridesProcessed, notificationsCreated }  on success
 *   - 403 { ok: false, error }   missing/incorrect `x-cron-secret`
 *   - 503 { ok: false, error }   CRON_SECRET not configured
 */
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'CRON_SECRET is not configured.' },
      { status: 503 }
    );
  }

  const supplied = request.headers.get('x-cron-secret');
  if (supplied !== expected) {
    return NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
  }

  try {
    const result = await processTripReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Trip reminder job failed:', error);
    return NextResponse.json({ ok: false, error: 'Internal server error.' }, { status: 500 });
  }
}
