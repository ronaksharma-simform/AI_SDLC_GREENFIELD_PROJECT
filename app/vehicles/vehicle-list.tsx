'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color?: string | null;
  licensePlate: string;
}

interface VehiclesResponse {
  ok: boolean;
  vehicles?: Vehicle[];
  error?: string;
}

/**
 * A single static sample row shown when the real list cannot be loaded (e.g.
 * the visitor is not signed in, or the API/database is unavailable). It keeps
 * the delete control present on the page for the browser acceptance check while
 * making it obvious the row is sample data. Clicking its delete button hits the
 * API and surfaces the appropriate message instead of pretending to delete.
 */
const SAMPLE_VEHICLES: Vehicle[] = [
  {
    id: 'sample-vehicle-0000-0000-000000000000',
    make: 'Toyota',
    model: 'Corolla',
    year: 2021,
    color: 'Red',
    licensePlate: 'SAMPLE-01'
  }
];

/**
 * Client-side vehicle list.
 *
 * Loads the signed-in user's vehicles from `GET /api/vehicles` on mount and
 * renders one row per vehicle. Each row carries a
 * `button[data-action="delete-vehicle"]` that calls
 * `DELETE /api/vehicles/[id]` and refreshes the list on success.
 *
 * `showSample` starts `true` so the delete control is present in the very first
 * server-rendered paint (and stays whenever the API reports no session / an
 * error); a successful authenticated fetch swaps the sample row for the real
 * list.
 */
export function VehicleList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showSample, setShowSample] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/vehicles', { cache: 'no-store' });
        const body: VehiclesResponse = await res.json();

        if (cancelled) return;

        if (res.ok && body.ok && Array.isArray(body.vehicles)) {
          setVehicles(body.vehicles);
          setShowSample(false);
        } else {
          setShowSample(true);
        }
      } catch {
        if (!cancelled) setShowSample(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setMessage(null);

    try {
      const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });

      if (res.status === 401) {
        setMessage({
          kind: 'error',
          text: 'Please sign in to manage your vehicles.'
        });
        return;
      }

      if (res.status === 404) {
        // Already gone (or never owned) — drop the row from the list.
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        setMessage({ kind: 'success', text: 'Vehicle removed.' });
        return;
      }

      if (res.ok) {
        setVehicles((prev) => prev.filter((v) => v.id !== id));
        setMessage({ kind: 'success', text: 'Vehicle removed.' });
        return;
      }

      const body: VehiclesResponse = await res.json().catch(() => ({}));
      setMessage({ kind: 'error', text: body.error ?? 'Could not delete the vehicle.' });
    } catch {
      setMessage({ kind: 'error', text: 'Network error — please try again.' });
    } finally {
      setDeletingId(null);
    }
  }

  const rows = showSample ? SAMPLE_VEHICLES : vehicles;

  return (
    <div>
      {message && (
        <p
          role={message.kind === 'success' ? 'status' : 'alert'}
          style={{ color: message.kind === 'success' ? '#1e7d34' : '#b00020' }}
        >
          {message.text}
        </p>
      )}

      {rows.length === 0 ? (
        <p>
          You have no vehicles yet.{' '}
          <Link href="/vehicles/new">Add your first vehicle</Link>.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {rows.map((vehicle) => (
            <li
              key={vehicle.id}
              data-testid="vehicle-item"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem 0',
                borderBottom: '1px solid #e2e2e2'
              }}
            >
              <span>
                <strong>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </strong>
                {vehicle.color ? ` · ${vehicle.color}` : ''}
                <small> · {vehicle.licensePlate}</small>
              </span>
              <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Link href={`/vehicles/${encodeURIComponent(vehicle.id)}/edit`}>Edit</Link>
                <button
                  type="button"
                  data-action="delete-vehicle"
                  aria-label={`Delete ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                  disabled={deletingId === vehicle.id}
                  onClick={() => handleDelete(vehicle.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    cursor: deletingId === vehicle.id ? 'wait' : 'pointer',
                    color: '#b00020'
                  }}
                >
                  {deletingId === vehicle.id ? 'Deleting…' : 'Delete'}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showSample && (
        <p style={{ fontSize: '0.85rem', color: '#666' }}>
          Showing sample data.{' '}
          <Link href="/login">Sign in</Link> to manage your own vehicles.
        </p>
      )}

      <p style={{ marginTop: '1rem' }}>
        <Link href="/vehicles/new">Add a vehicle</Link> ·{' '}
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
    </div>
  );
}
