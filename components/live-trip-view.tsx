'use client';

import { useEffect, useRef, useState } from 'react';
import { Car, CircleCheck, MapPinned, Radio } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { LiveTripMapHandle, MapPoint } from '@/components/live-trip-map';
import { distanceMeters } from '@/lib/rides';
import { isLocationStale, secondsSinceLastUpdate } from '@/lib/trip-tracking';

/**
 * Seeker-facing live trip view (Section 7). Consumes the trip/location API from
 * Part B by polling `GET /api/rides/{id}/location` at a short interval and
 * rendering the Provider's moving position on a Leaflet map, alongside static
 * pickup/destination pins.
 *
 * Real-time transport is polling in this build (no WebSocket infrastructure);
 * the spec explicitly permits a polling fallback (Section 10.3). The interval is
 * consistent with how often the Provider's device reports (5s).
 */

const POLL_INTERVAL_MS = 5000;

interface LiveLocationRide {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  locationUpdatedAt: string | null;
  sourceLatitude: number | null;
  sourceLongitude: number | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
}

interface LocationResponse {
  ok: boolean;
  ride?: LiveLocationRide;
  error?: string;
}

interface LiveTripViewProps {
  rideId: string;
  initial: LiveLocationRide;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(1, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function LiveTripView({ rideId, initial }: LiveTripViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapHandleRef = useRef<LiveTripMapHandle | null>(null);
  const hasProviderFixRef = useRef(false);
  const [ride, setRide] = useState<LiveLocationRide>(initial);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setTick] = useState(0); // re-render to refresh the staleness counter

  const isInProgress = ride.status === 'IN_PROGRESS';
  const isEnded = ride.status === 'COMPLETED' || ride.status === 'CANCELLED';

  const providerPoint: MapPoint | null =
    ride.currentLatitude != null && ride.currentLongitude != null
      ? { latitude: ride.currentLatitude, longitude: ride.currentLongitude }
      : null;

  const stale = isLocationStale(ride.locationUpdatedAt);
  const secondsSince = secondsSinceLastUpdate(ride.locationUpdatedAt);

  const distanceFromPickup =
    providerPoint && ride.sourceLatitude != null && ride.sourceLongitude != null
      ? distanceMeters(providerPoint, {
          latitude: ride.sourceLatitude,
          longitude: ride.sourceLongitude
        })
      : null;

  // Create the map once, lazily, so Leaflet never loads during SSR.
  useEffect(() => {
    let handle: LiveTripMapHandle | null = null;
    let cancelled = false;

    import('@/components/live-trip-map').then(({ createLiveTripMap }) => {
      if (cancelled || !containerRef.current) return;
      handle = createLiveTripMap(containerRef.current, {
        source:
          ride.sourceLatitude != null && ride.sourceLongitude != null
            ? { latitude: ride.sourceLatitude, longitude: ride.sourceLongitude }
            : null,
        destination:
          ride.destinationLatitude != null && ride.destinationLongitude != null
            ? { latitude: ride.destinationLatitude, longitude: ride.destinationLongitude }
            : null,
        initialProvider: providerPoint ?? null
      });
      if (providerPoint) hasProviderFixRef.current = true;
      mapHandleRef.current = handle;
    });

    return () => {
      cancelled = true;
      handle?.destroy();
      mapHandleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the live location while the trip is In Progress.
  useEffect(() => {
    if (!isInProgress) return;

    let active = true;
    let lastPointKey = '';

    async function poll() {
      try {
        const res = await fetch(`/api/rides/${rideId}/location`);
        if (!active) return;
        if (res.status === 401) {
          setLoadError('Your session expired. Please sign in again.');
          return;
        }
        const body: LocationResponse = await res.json();
        if (!active) return;
        if (res.ok && body.ride) {
          setRide(body.ride);
          const next = body.ride;
          const pointKey =
            next.currentLatitude != null && next.currentLongitude != null
              ? `${next.currentLatitude.toFixed(6)},${next.currentLongitude.toFixed(6)}`
              : '';
          if (
            pointKey &&
            pointKey !== lastPointKey &&
            next.currentLatitude != null &&
            next.currentLongitude != null
          ) {
            lastPointKey = pointKey;
            mapHandleRef.current?.setProviderLocation({
              latitude: next.currentLatitude,
              longitude: next.currentLongitude
            });
            if (!hasProviderFixRef.current) {
              hasProviderFixRef.current = true;
              mapHandleRef.current?.flyTo({
                latitude: next.currentLatitude,
                longitude: next.currentLongitude
              });
            }
          }
          setLoadError(null);
        } else {
          setLoadError(body.error ?? 'Could not load the live trip.');
        }
      } catch {
        if (active) setLoadError('Network error — retrying…');
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isInProgress, rideId]);

  // Refresh the "Last updated Xs ago" counter every second while stale or live.
  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Radio className="h-4 w-4 text-primary" />
            Live trip
          </h2>
          <Badge variant={isEnded ? 'outline' : 'success'}>
            {ride.status === 'IN_PROGRESS'
              ? 'In progress'
              : ride.status === 'COMPLETED'
                ? 'Completed'
                : ride.status === 'CANCELLED'
                  ? 'Cancelled'
                  : ride.status}
          </Badge>
        </div>

        {isInProgress ? (
          <p className="text-sm text-muted-foreground">
            Your ride is on the way
            {providerPoint
              ? distanceFromPickup != null
                ? ` — the provider is about ${formatDistance(distanceFromPickup)} from the pickup point.`
                : '.'
              : ' — waiting for the provider’s location…'}
          </p>
        ) : null}

        {/* The live Leaflet map. Hidden in the ended summary state. */}
        <div
          ref={containerRef}
          className="z-0 h-64 w-full overflow-hidden rounded-md border"
          aria-label="Live provider location map"
        />

        {isInProgress && providerPoint ? (
          stale ? (
            <Alert variant="warning">
              <AlertTitle>Location signal lost</AlertTitle>
              <AlertDescription>
                Last updated{' '}
                {secondsSince != null && secondsSince > 0 ? `${secondsSince}s ago` : 'a moment ago'}.
                The provider may be in an area with poor signal.
              </AlertDescription>
            </Alert>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-primary" />
              Location updated{' '}
              {secondsSince != null && secondsSince > 0 ? `${secondsSince}s ago` : 'just now'}.
            </p>
          )
        ) : null}

        {isEnded ? (
          <Alert>
            <CircleCheck className="h-4 w-4" />
            <AlertTitle>
              {ride.status === 'COMPLETED' ? 'Trip complete' : 'Trip cancelled'}
            </AlertTitle>
            <AlertDescription>
              Location sharing has stopped. {ride.status === 'COMPLETED' ? 'Thanks for riding!' : ''}
            </AlertDescription>
          </Alert>
        ) : null}

        {loadError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {loadError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPinned className="h-3.5 w-3.5 text-red-600" />
            Pickup
          </span>
          <span className="flex items-center gap-1.5">
            <Car className="h-3.5 w-3.5 text-green-600" />
            Destination
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
