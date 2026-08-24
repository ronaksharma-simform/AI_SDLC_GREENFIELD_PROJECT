'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navigation, Radio, Square, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';

/**
 * Provider-side trip control (Section 6). Mounted on the Provider's Ride Detail
 * page:
 *
 *   - A "Start trip" action once the ride is Active/Full and its departure time
 *     is at or near, with a confirmation step.
 *   - While In Progress, a "Location sharing active" indicator and an "End Trip"
 *     action, both with confirmation.
 *
 * Location capture uses the device's geolocation capability and reports the raw
 * position to `POST /api/rides/{id}/location` at a controlled interval
 * (Section 8 — no throttling/broadcast logic lives on the frontend beyond this
 * interval).
 */

/** How often the Provider's device reports position (Section 10.2: every 5–10s). */
const REPORT_INTERVAL_MS = 5000;

/** Start is offered once departure is at or near (Section 6). */
const START_WINDOW_MS = 30 * 60 * 1000;

interface ProviderTripControlProps {
  rideId: string;
  status: string;
  departureTime: string;
}

export function ProviderTripControl({ rideId, status, departureTime }: ProviderTripControlProps) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [actionError, setActionError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const departure = new Date(departureTime).getTime();
  const startEligible =
    (currentStatus === 'ACTIVE' || currentStatus === 'FULL') &&
    departure <= Date.now() + START_WINDOW_MS;

  // Keep the derived state in sync when the server page refreshes.
  useEffect(() => {
    setCurrentStatus(status);
    if (status === 'IN_PROGRESS') {
      startWatching();
    } else if (status !== 'IN_PROGRESS') {
      stopWatching();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  function stopWatching() {
    if (watchIdRef.current != null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
  }

  async function reportPosition(position: GeolocationPosition) {
    const { latitude, longitude } = position.coords;
    const now = Date.now();
    if (now - lastSentRef.current < REPORT_INTERVAL_MS) return;
    lastSentRef.current = now;

    try {
      const res = await fetch(`/api/rides/${rideId}/location`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ latitude, longitude })
      });
      if (res.status === 401) {
        setLocationError('Your session expired. Location sharing paused.');
        return;
      }
      const body: { ok: boolean; error?: string } = await res.json();
      if (res.ok && body.ok) {
        setLocationError(null);
        setSharing(true);
      } else if (res.status === 409) {
        // Trip is no longer In Progress — stop reporting and let refresh catch up.
        stopWatching();
      } else if (res.status === 429) {
        // Rate-limited; the next report at our own interval will be accepted.
        setSharing(true);
      } else {
        setLocationError(body.error ?? 'Could not share location.');
      }
    } catch {
      setLocationError('Network error — location sharing paused.');
    }
  }

  function startWatching() {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not available on this device.');
      return;
    }
    if (watchIdRef.current != null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => void reportPosition(position),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Location permission denied — Seekers cannot see your position.');
        } else {
          setLocationError('Unable to get your location. Retrying…');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
  }

  useEffect(() => {
    if (currentStatus === 'IN_PROGRESS') startWatching();
    return () => stopWatching();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStatus]);

  async function handleStart() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/rides/${rideId}/start`, { method: 'POST' });
      const body: { ok: boolean; error?: string } = await res.json();
      if (res.ok && body.ok) {
        setCurrentStatus('IN_PROGRESS');
        startWatching();
        router.refresh();
      } else {
        setActionError(body.error ?? 'Could not start the trip.');
      }
    } catch {
      setActionError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEnd() {
    setBusy(true);
    setActionError(null);
    stopWatching();
    try {
      const res = await fetch(`/api/rides/${rideId}/complete`, { method: 'POST' });
      const body: { ok: boolean; error?: string } = await res.json();
      if (res.ok && body.ok) {
        setCurrentStatus('COMPLETED');
        router.refresh();
      } else {
        setActionError(body.error ?? 'Could not end the trip.');
        startWatching();
      }
    } catch {
      setActionError('Network error — please try again.');
      startWatching();
    } finally {
      setBusy(false);
    }
  }

  if (currentStatus === 'IN_PROGRESS') {
    return (
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="success">
              <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-current" />
              Trip in progress
            </Badge>
            {sharing ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Radio className="h-4 w-4 text-primary" />
                Location sharing active
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <WifiOff className="h-4 w-4 text-muted-foreground" />
                Waiting for location…
              </span>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={busy}>
                <Square className="h-4 w-4" />
                End trip
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End this trip?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ending the trip stops location sharing immediately and marks the
                  ride as completed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleEnd()} disabled={busy}>
                  End trip
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {locationError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {locationError}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {actionError}
          </p>
        ) : null}
      </CardBody>
    );
  }

  if (startEligible) {
    return (
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Ready to head out? Start the trip to share your live location with
            confirmed riders.
          </p>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" disabled={busy}>
                <Navigation className="h-4 w-4" />
                Start trip
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start this trip now?</AlertDialogTitle>
                <AlertDialogDescription>
                  Starting the trip begins broadcasting your live location to
                  every Seeker with an accepted seat on this ride.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleStart()} disabled={busy}>
                  Start trip
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {actionError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {actionError}
          </p>
        ) : null}
      </CardBody>
    );
  }

  return null;
}

function CardBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="space-y-3">{children}</div>
    </div>
  );
}
