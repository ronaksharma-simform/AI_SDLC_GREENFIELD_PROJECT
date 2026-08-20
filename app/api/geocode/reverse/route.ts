import { z } from 'zod';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { reverseGeocode, GeocodeProviderError, GeocodeRateLimitedError } from '@/lib/geocode';

/**
 * GET /api/geocode/reverse?lat={lat}&lng={lng}
 *
 * Backend proxy for reverse geocoding (Section 9 — API Surface). The browser
 * never talks to the geocoding provider directly, so the provider's API key
 * stays server-side and per-user rate limits / caching are applied centrally.
 *
 * Responses:
 *   - 200 { ok: true, location: { latitude, longitude, address, placeId? } }
 *   - 400 { ok: false, error, details? }  missing/invalid coordinates
 *   - 401 { ok: false, error }            no valid session
 *   - 429 { ok: false, error }            per-user request budget exhausted
 *   - 502 { ok: false, error }            provider failure / no result
 */
const querySchema = z.object({
  lat: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90.')
    .max(90, 'Latitude must be between -90 and 90.'),
  lng: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180.')
    .max(180, 'Longitude must be between -180 and 180.')
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    lat: url.searchParams.get('lat'),
    lng: url.searchParams.get('lng')
  });

  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: 'Invalid coordinates.',
        details: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const { lat, lng } = parsed.data;

  try {
    const location = await reverseGeocode(lat, lng, { userKey: session.user.id });
    return NextResponse.json({ ok: true, location });
  } catch (error) {
    if (error instanceof GeocodeRateLimitedError) {
      return Response.json({ ok: false, error: error.message }, { status: 429 });
    }
    if (error instanceof GeocodeProviderError) {
      return Response.json(
        { ok: false, error: 'Could not resolve an address for this location. You can type it manually.' },
        { status: 502 }
      );
    }
    // eslint-disable-next-line no-console
    console.error('Reverse geocoding failed:', error);
    return Response.json(
      { ok: false, error: 'Could not resolve an address for this location. You can type it manually.' },
      { status: 502 }
    );
  }
}
