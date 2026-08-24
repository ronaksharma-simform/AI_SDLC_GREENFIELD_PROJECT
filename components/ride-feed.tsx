'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, MapPin, Search, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/field';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LocationPicker, type LocationValue } from '@/components/location-picker';
import { buildRideFeedQuery } from '@/lib/ride-feed';
import { formatDateTime } from '@/lib/format-date';
import { vehicleTypeLabel } from '@/lib/vehicle';

export interface RideFeedItem {
  id: string;
  providerId: string;
  sourceAddress: string;
  destinationAddress: string;
  departureTime: string;
  seatsTotal: number;
  seatsAvailable: number;
  status: string;
  notes: string | null;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    vehicleType: string;
    seatCapacity: number;
  };
  provider: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface FeedResponse {
  ok: boolean;
  rides?: RideFeedItem[];
  error?: string;
}

interface FeedFilters {
  source: LocationValue | null;
  destination: LocationValue | null;
  time: string;
  seats: string;
}

const EMPTY_FILTERS: FeedFilters = { source: null, destination: null, time: '', seats: '' };

/** Loading placeholder shown while results are fetched (Part A §4). */
function RideCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="space-y-3 p-5">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

function RideCard({ ride }: { ride: RideFeedItem }) {
  return (
    <Card hover>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">
              <span className="truncate">{ride.sourceAddress}</span>
              <span className="text-muted-foreground">&rarr;</span>
              <span className="truncate">{ride.destinationAddress}</span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDateTime(ride.departureTime)}
            </p>
          </div>
          <Badge variant="outline">
            {ride.seatsAvailable} of {ride.seatsTotal} seats
          </Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {ride.seatsAvailable} available
          </span>
          <span>
            {ride.vehicle.year} {ride.vehicle.make} {ride.vehicle.model} ·{' '}
            {vehicleTypeLabel(ride.vehicle.vehicleType)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            Provider: {ride.provider.name ?? ride.provider.email}
          </span>
        </div>

        {ride.notes ? (
          <p className="mt-2 text-sm text-muted-foreground">&ldquo;{ride.notes}&rdquo;</p>
        ) : null}

        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/rides/feed/${ride.id}`}>View ride</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Ride Feed view (Part A §4). A client component so the filter bar can update
 * the results without a full page navigation:
 *
 *   - source / destination use the shared Location Picker (the source picker's
 *     coordinates also drive the backend proximity filter);
 *   - a desired departure time and seat count narrow the feed further;
 *   - results load with skeleton cards, an empty state, and inline errors.
 */
export function RideFeed() {
  const [source, setSource] = useState<LocationValue | null>(null);
  const [destination, setDestination] = useState<LocationValue | null>(null);
  const [time, setTime] = useState('');
  const [seats, setSeats] = useState('');

  const [rides, setRides] = useState<RideFeedItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function runSearch(filters: FeedFilters) {
    setLoading(true);
    setError(null);
    try {
      const query = buildRideFeedQuery(filters);
      const res = await fetch(`/api/rides/feed${query}`);
      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        setRides([]);
        return;
      }
      const body: FeedResponse = await res.json();
      if (res.ok && body.ok) {
        setRides(body.rides ?? []);
      } else {
        setError(body.error ?? 'Could not load rides.');
        setRides([]);
      }
    } catch {
      setError('Network error — could not load rides.');
      setRides([]);
    } finally {
      setLoading(false);
    }
  }

  // Load the full feed on first mount.
  useEffect(() => {
    void runSearch(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    void runSearch({ source, destination, time, seats });
  }

  function handleClear() {
    setSource(null);
    setDestination(null);
    setTime('');
    setSeats('');
    void runSearch(EMPTY_FILTERS);
  }

  const showSkeletons = loading && rides === null;

  return (
    <main className="container py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Find a ride</h1>
          <p className="mt-1 text-muted-foreground">
            Browse available rides and request to join one that fits.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>
              Optional and combinable. A source location also narrows results by
              proximity using the default radius.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} noValidate className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <LocationPicker
                  id="feed-source"
                  label="Source"
                  value={source}
                  onChange={setSource}
                  hint="Pickup point"
                />
                <LocationPicker
                  id="feed-destination"
                  label="Destination"
                  value={destination}
                  onChange={setDestination}
                  hint="Drop-off point"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Desired departure time"
                  htmlFor="feed-time"
                  hint="Optional — ±30 minutes by default"
                >
                  <Input
                    id="feed-time"
                    type="datetime-local"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </Field>
                <Field
                  label="Seats needed"
                  htmlFor="feed-seats"
                  hint="Optional"
                >
                  <Input
                    id="feed-seats"
                    type="number"
                    min={1}
                    value={seats}
                    onChange={(event) => setSeats(event.target.value)}
                    placeholder="1"
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Search className="h-4 w-4 animate-pulse" />
                      Searching…
                    </>
                  ) : (
                    <>
                      <Search />
                      Search
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleClear} disabled={loading}>
                  <X />
                  Clear filters
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {showSkeletons ? (
          <div className="space-y-4" aria-label="Loading rides" role="status">
            {Array.from({ length: 3 }).map((_, index) => (
              <RideCardSkeleton key={index} />
            ))}
          </div>
        ) : rides && rides.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <CalendarClock className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">No rides match your filters</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try widening the time window, searching from a nearby pickup
                  point, or clearing some filters.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={handleClear}>
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : rides ? (
          <div className="space-y-4">
            {rides.map((ride) => (
              <RideCard key={ride.id} ride={ride} />
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
