/**
 * Client-only Leaflet map used by the location picker.
 *
 * This module imports Leaflet at the top level and is therefore only ever
 * loaded in the browser (the picker dynamically `import()`s it inside a
 * `useEffect`, so it never runs during server-side rendering). The map shows
 * OpenStreetMap tiles and a single draggable pin. It has no knowledge of
 * geocoding — the picker wires up search / reverse-geocoding around it.
 */

import L from 'leaflet';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface LocationMapOptions {
  /** Pre-place the pin at this point when the map is created. */
  initial?: MapPoint | null;
  /** Called when the user clicks the map or drops the pin after a drag. */
  onSelect: (point: MapPoint) => void;
}

export interface LocationMapHandle {
  /** Places (or moves) the pin without panning. */
  setLocation: (point: MapPoint) => void;
  /** Places the pin and pans/zooms the map to it (used for search results). */
  flyTo: (point: MapPoint) => void;
  /** Tears down the Leaflet map and its event listeners. */
  destroy: () => void;
}

/** Default view used when no initial point is supplied (New York City). */
const DEFAULT_CENTER: L.LatLngTuple = [40.7128, -74.006];
const DEFAULT_ZOOM = 12;
const FLY_ZOOM = 15;

/** A crisp SVG pin so we don't depend on Leaflet's default image assets. */
const PIN_ICON = L.divIcon({
  className: '',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="44"
         style="color:#dc2626;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="currentColor" stroke="#fff" stroke-width="1.2"/>
      <circle cx="12" cy="10" r="3" fill="#fff"/>
    </svg>
  `,
  iconSize: [34, 44],
  iconAnchor: [17, 42],
  popupAnchor: [0, -40]
});

export function createLocationMap(container: HTMLElement, options: LocationMapOptions): LocationMapHandle {
  const center: L.LatLngTuple = options.initial
    ? [options.initial.latitude, options.initial.longitude]
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

  let marker: L.Marker | null = null;

  function placeMarker(point: MapPoint, fly = false): void {
    const latLng: L.LatLngTuple = [point.latitude, point.longitude];

    if (marker) {
      marker.setLatLng(latLng);
    } else {
      marker = L.marker(latLng, { icon: PIN_ICON, draggable: true });
      marker.on('dragend', () => {
        const latlng = marker?.getLatLng();
        if (latlng) options.onSelect({ latitude: latlng.lat, longitude: latlng.lng });
      });
      marker.addTo(map);
    }

    if (fly) {
      map.flyTo(latLng, Math.max(map.getZoom(), FLY_ZOOM));
    }
  }

  map.on('click', (event: L.LeafletMouseEvent) => {
    const point = { latitude: event.latlng.lat, longitude: event.latlng.lng };
    placeMarker(point);
    options.onSelect(point);
  });

  if (options.initial) {
    placeMarker(options.initial);
  }

  return {
    setLocation: (point) => placeMarker(point),
    flyTo: (point) => placeMarker(point, true),
    destroy: () => {
      map.remove();
    }
  };
}
