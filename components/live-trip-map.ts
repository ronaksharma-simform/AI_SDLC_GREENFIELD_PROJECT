/**
 * Client-only Leaflet map for the live trip view.
 *
 * Mirrors the Location Picker's map pattern: this module imports Leaflet at the
 * top level and is therefore only ever loaded in the browser (the live trip view
 * dynamically `import()`s it inside a `useEffect`, so it never runs during
 * server-side rendering). It shows static pickup/destination pins plus a moving
 * marker for the Provider's live position.
 */

import L from 'leaflet';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface LiveTripMapOptions {
  /** Static pickup point pin. */
  source?: MapPoint | null;
  /** Static destination point pin. */
  destination?: MapPoint | null;
  /** Pre-place the Provider marker here when the map is created. */
  initialProvider?: MapPoint | null;
}

export interface LiveTripMapHandle {
  /** Moves the Provider's live marker to a new position (no pan). */
  setProviderLocation: (point: MapPoint) => void;
  /** Pans/zooms the map to a point (used when a provider fix first arrives). */
  flyTo: (point: MapPoint) => void;
  /** Tears down the Leaflet map and its event listeners. */
  destroy: () => void;
}

/** Default view used when no coordinates are supplied (New York City). */
const DEFAULT_CENTER: L.LatLngTuple = [40.7128, -74.006];
const DEFAULT_ZOOM = 12;
const FLY_ZOOM = 15;

/** Red pin for the pickup point (same visual language as the picker). */
const SOURCE_ICON = L.divIcon({
  className: '',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="38"
         style="color:#dc2626;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="currentColor" stroke="#fff" stroke-width="1.2"/>
      <circle cx="12" cy="10" r="3" fill="#fff"/>
    </svg>
  `,
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  popupAnchor: [0, -34]
});

/** Green checkered pin for the destination point. */
const DESTINATION_ICON = L.divIcon({
  className: '',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="30" height="38"
         style="color:#16a34a;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="currentColor" stroke="#fff" stroke-width="1.2"/>
      <circle cx="12" cy="10" r="3" fill="#fff"/>
    </svg>
  `,
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  popupAnchor: [0, -34]
});

/** A pulsing blue "live" dot for the Provider's moving position. */
const PROVIDER_ICON = L.divIcon({
  className: '',
  html: `
    <div style="position:relative;width:18px;height:18px">
      <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(37,99,235,0.35);animation:coride-ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></span>
      <span style="position:absolute;inset:3px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.45)"></span>
    </div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

export function createLiveTripMap(container: HTMLElement, options: LiveTripMapOptions): LiveTripMapHandle {
  const center: L.LatLngTuple = options.initialProvider
    ? [options.initialProvider.latitude, options.initialProvider.longitude]
    : options.source
      ? [options.source.latitude, options.source.longitude]
      : DEFAULT_CENTER;

  const map = L.map(container, {
    center,
    zoom: DEFAULT_ZOOM,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  if (options.source) {
    L.marker([options.source.latitude, options.source.longitude], { icon: SOURCE_ICON }).addTo(map);
  }
  if (options.destination) {
    L.marker([options.destination.latitude, options.destination.longitude], { icon: DESTINATION_ICON }).addTo(map);
  }

  let providerMarker: L.Marker | null = null;

  function placeProvider(point: MapPoint, fly = false): void {
    const latLng: L.LatLngTuple = [point.latitude, point.longitude];

    if (providerMarker) {
      providerMarker.setLatLng(latLng);
    } else {
      providerMarker = L.marker(latLng, { icon: PROVIDER_ICON, interactive: false });
      providerMarker.addTo(map);
    }

    if (fly) {
      map.flyTo(latLng, Math.max(map.getZoom(), FLY_ZOOM));
    }
  }

  if (options.initialProvider) {
    placeProvider(options.initialProvider);
  }

  return {
    setProviderLocation: (point) => placeProvider(point),
    flyTo: (point) => placeProvider(point, true),
    destroy: () => {
      map.remove();
    }
  };
}
