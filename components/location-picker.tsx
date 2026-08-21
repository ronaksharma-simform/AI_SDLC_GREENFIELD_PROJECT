'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';

import { Field } from '@/components/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { LocationMapHandle, MapPoint } from '@/components/location-map';

export interface LocationValue {
  latitude: number;
  longitude: number;
  address: string;
  placeId?: string;
}

interface PlaceResult {
  placeId?: string;
  label: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  id: string;
  label: string;
  value: LocationValue | null;
  onChange: (location: LocationValue | null) => void;
  errors?: string[];
  disabled?: boolean;
  /** Pre-filled address used when `value` has no coordinates yet (legacy rides). */
  initialAddress?: string;
  hint?: string;
}

/** Drags fire a single reverse-geocoding call after the pin stops moving. */
const REVERSE_DEBOUNCE_MS = 350;

/** Forward-geocoding fires only after the user pauses typing (FIX-2). */
const SEARCH_DEBOUNCE_MS = 400;

export function LocationPicker({
  id,
  label,
  value,
  onChange,
  errors,
  disabled,
  initialAddress,
  hint
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapHandleRef = useRef<LocationMapHandle | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeqRef = useRef(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [address, setAddress] = useState(value?.address ?? initialAddress ?? '');

  // Keep the editable address in sync with external value changes (e.g. the
  // server response written back after a save).
  useEffect(() => {
    setAddress(value?.address ?? initialAddress ?? '');
  }, [value?.address, initialAddress]);

  // Create the map once, lazily, so Leaflet never loads during SSR.
  useEffect(() => {
    let handle: LocationMapHandle | null = null;
    let cancelled = false;

    import('@/components/location-map').then(({ createLocationMap }) => {
      if (cancelled || !containerRef.current) return;
      handle = createLocationMap(containerRef.current, {
        initial: value ? { latitude: value.latitude, longitude: value.longitude } : null,
        onSelect: (point) => handlePointSelected(point)
      });
      mapHandleRef.current = handle;
    });

    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      handle?.destroy();
      mapHandleRef.current = null;
    };
    // The map is created once; the current location is pushed to it below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push external location changes (search-result selection, form reset, prefill)
  // to the map pin.
  useEffect(() => {
    if (value && mapHandleRef.current) {
      mapHandleRef.current.setLocation({ latitude: value.latitude, longitude: value.longitude });
    }
  }, [value?.latitude, value?.longitude]);

  async function resolveAddress(point: MapPoint) {
    setResolving(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${point.latitude}&lng=${point.longitude}`);
      const body = await res.json();
      if (res.ok && body.ok && body.location) {
        const loc = body.location as LocationValue;
        setAddress(loc.address);
        setGeocodeFailed(false);
        onChangeRef.current({
          latitude: loc.latitude,
          longitude: loc.longitude,
          address: loc.address,
          placeId: loc.placeId
        });
      } else {
        // REQ-10: coordinates were captured but the address is left blank and
        // editable rather than blocking the form.
        setGeocodeFailed(true);
      }
    } catch {
      setGeocodeFailed(true);
    } finally {
      setResolving(false);
    }
  }

  function handlePointSelected(point: MapPoint) {
    setAddress('');
    setGeocodeFailed(false);
    onChangeRef.current({ latitude: point.latitude, longitude: point.longitude, address: '' });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void resolveAddress(point);
    }, REVERSE_DEBOUNCE_MS);
  }

  async function runSearch(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;

    const seq = ++searchSeqRef.current;
    setSearching(true);
    setSearchError(null);
    // Clear previous results while a new search is in flight so loading,
    // no-results, and error states stay visually distinct (FIX-4).
    setResults(null);
    try {
      const res = await fetch(`/api/geocode/search?query=${encodeURIComponent(trimmed)}`);
      const body = await res.json();
      if (seq !== searchSeqRef.current) return; // stale response, ignore
      if (res.ok && body.ok) {
        setResults(body.results as PlaceResult[]);
      } else {
        setResults(null);
        setSearchError(body.error ?? 'Place search failed.');
      }
    } catch {
      if (seq !== searchSeqRef.current) return;
      setResults(null);
      setSearchError('Place search failed. Select the location directly on the map instead.');
    } finally {
      if (seq === searchSeqRef.current) setSearching(false);
    }
  }

  // FIX-2: debounce the search input so a request fires only after the user
  // pauses typing, not on every keystroke. Any in-flight request is invalidated
  // as soon as the query changes so stale results never render.
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchSeqRef.current += 1;

    const query = searchQuery.trim();
    if (!query) {
      setSearching(false);
      setSearchError(null);
      setResults(null);
      return;
    }

    setSearching(false);
    searchDebounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, SEARCH_DEBOUNCE_MS);
  }, [searchQuery]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    void runSearch(searchQuery);
  }

  function handleSelectPlace(place: PlaceResult) {
    const loc: LocationValue = {
      latitude: place.latitude,
      longitude: place.longitude,
      address: place.label,
      placeId: place.placeId
    };
    mapHandleRef.current?.flyTo({ latitude: place.latitude, longitude: place.longitude });
    setAddress(place.label);
    setGeocodeFailed(false);
    setResults(null);
    setSearchQuery('');
    onChangeRef.current(loc);
  }

  function handleAddressChange(next: string) {
    setAddress(next);
    if (value) {
      onChangeRef.current({ ...value, address: next });
    }
  }

  return (
    <Field label={label} htmlFor={`${id}-address`} errors={errors} hint={hint} required>
      <div className="space-y-2">
        <div className="relative">
          <form onSubmit={handleSearch} className="flex gap-2" role="search">
            <Input
              type="text"
              placeholder="Search for a place or address"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              disabled={disabled}
              aria-label={`Search ${label.toLowerCase()}`}
            />
            <Button
              type="submit"
              variant="outline"
              size="icon"
              disabled={disabled || searching}
              aria-label="Search"
            >
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>

          {searching || results !== null ? (
            <ul
              className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
              aria-busy={searching}
            >
              {searching ? (
                <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </li>
              ) : results !== null && results.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  No places found. Try a different name or pick a point on the map.
                </li>
              ) : (
                results!.map((place) => (
                  <li key={place.placeId ?? place.label}>
                    <button
                      type="button"
                      onClick={() => handleSelectPlace(place)}
                      disabled={disabled}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed"
                    >
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{place.label}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}

          {searchError ? (
            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
              {searchError}
            </p>
          ) : null}
        </div>

        <div
          ref={containerRef}
          className={cn(
            'z-0 h-56 w-full overflow-hidden rounded-md border',
            disabled && 'opacity-60'
          )}
          aria-hidden="true"
        />

        <div className="space-y-1">
          <div className="relative">
            <Input
              id={`${id}-address`}
              type="text"
              value={address}
              onChange={(event) => handleAddressChange(event.target.value)}
              disabled={disabled}
              placeholder="Select a point on the map, then confirm the name"
              maxLength={255}
              aria-invalid={errors?.length ? true : undefined}
            />
            {resolving ? (
              <span className="absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </span>
            ) : null}
          </div>

          {geocodeFailed ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              Couldn&rsquo;t resolve an address automatically — type the location name manually.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Tap the map or drag the pin to set the point.
          </p>
        </div>
      </div>
    </Field>
  );
}
