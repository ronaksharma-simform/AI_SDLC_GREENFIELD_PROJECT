import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { searchPlaces, GeocodeProviderError, GeocodeRateLimitedError } from '@/lib/geocode';

/**
 * GET /api/geocode/search?query={text}
 *
 * Backend proxy for forward geocoding / place search (Section 9 — API Surface),
 * used by the picker's search box. Like the reverse endpoint, it keeps the
 * provider's key server-side and applies per-user rate limits and caching.
 *
 * Responses:
 *   - 200 { ok: true, results: [{ placeId?, label, latitude, longitude }] }
 *   - 400 { ok: false, error, details? }  missing/empty/over-long query
 *   - 401 { ok: false, error }            no valid session
 *   - 429 { ok: false, error }            per-user request budget exhausted
 *   - 502 { ok: false, error }            provider failure
 */
const querySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'A search query is required.')
    .max(200, 'Search query must be at most 200 characters long.')
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ query: url.searchParams.get('query') });

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: 'Invalid search query.',
        details: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  try {
    const results = await searchPlaces(parsed.data.query, { userKey: session.user.id });
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    if (error instanceof GeocodeRateLimitedError) {
      return Response.json({ ok: false, error: error.message }, { status: 429 });
    }
    if (error instanceof GeocodeProviderError) {
      return Response.json(
        { ok: false, error: 'Place search failed. You can select the location directly on the map instead.' },
        { status: 502 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Place search failed:', error);
    return Response.json(
      { ok: false, error: 'Place search failed. You can select the location directly on the map instead.' },
      { status: 502 }
    );
  }
}
