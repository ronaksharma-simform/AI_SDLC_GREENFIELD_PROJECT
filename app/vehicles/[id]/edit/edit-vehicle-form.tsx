'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Vehicle {
  id: string;
  ownerId: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  licensePlate: string;
  seatCapacity: number;
  vehicleType: string;
}

interface VehicleResponse {
  ok: boolean;
  vehicle?: Vehicle;
  error?: string;
  details?: Record<string, string[]>;
}

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'HATCHBACK', 'VAN', 'COUPE', 'CONVERTIBLE', 'TRUCK', 'OTHER'] as const;

/**
 * Edit-vehicle form.
 *
 * The form is always rendered (with its submit button) so the page is usable
 * immediately. On mount it loads the vehicle via `GET /api/vehicles/[id]` and
 * populates the fields; on submit it sends a PATCH with the (partial) payload.
 * Ownership and 404 handling are performed by the API, and the resulting
 * status is surfaced inline.
 */
export function EditVehicleForm({ vehicleId }: { vehicleId: string }) {
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/vehicles/${vehicleId}`, { cache: 'no-store' });
        const body: VehicleResponse = await res.json();

        if (cancelled) return;

        if (res.ok && body.vehicle) {
          setVehicle(body.vehicle);
        } else if (res.status === 404) {
          setLoadError('Vehicle not found.');
        } else if (res.status === 401) {
          setLoadError('Your session expired. Please sign in again.');
        } else {
          setLoadError(body.error ?? 'Could not load the vehicle.');
        }
      } catch {
        if (!cancelled) setLoadError('Network error — could not load the vehicle.');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      make: String(formData.get('make') ?? '').trim(),
      model: String(formData.get('model') ?? '').trim(),
      year: Number(formData.get('year')),
      color: String(formData.get('color') ?? '').trim() || undefined,
      licensePlate: String(formData.get('licensePlate') ?? '').trim(),
      seatCapacity: Number(formData.get('seatCapacity')),
      vehicleType: String(formData.get('vehicleType') ?? '')
    };

    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        setMessage({ kind: 'error', text: 'Your session expired. Please sign in again.' });
        return;
      }

      const body: VehicleResponse = await res.json();
      if (res.ok && body.vehicle) {
        setVehicle(body.vehicle);
        setMessage({ kind: 'success', text: 'Vehicle updated successfully.' });
      } else if (res.status === 404) {
        setMessage({ kind: 'error', text: 'Vehicle not found.' });
      } else if (res.status === 400 && body.details) {
        setMessage({ kind: 'error', text: body.error ?? 'Please fix the highlighted fields.' });
      } else {
        setMessage({ kind: 'error', text: body.error ?? 'Something went wrong. Please try again.' });
      }
    } catch {
      setMessage({ kind: 'error', text: 'Network error — please try again.' });
    } finally {
      setSaving(false);
    }
  }

  const v = vehicle;

  return (
    <form onSubmit={handleSubmit} noValidate>
      {loadError && (
        <p role="alert" style={{ color: '#b00020' }}>
          {loadError}
        </p>
      )}
      {message && (
        <p
          role={message.kind === 'success' ? 'status' : 'alert'}
          style={{ color: message.kind === 'success' ? '#1e7d34' : '#b00020' }}
        >
          {message.text}
        </p>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="make" style={labelStyle}>
          Make
        </label>
        <input id="make" name="make" type="text" required autoComplete="off" defaultValue={v?.make ?? ''} style={inputStyle} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="model" style={labelStyle}>
          Model
        </label>
        <input id="model" name="model" type="text" required autoComplete="off" defaultValue={v?.model ?? ''} style={inputStyle} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="year" style={labelStyle}>
          Year
        </label>
        <input id="year" name="year" type="number" required min={1900} max={2100} defaultValue={v?.year ?? ''} style={inputStyle} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="color" style={labelStyle}>
          Color
        </label>
        <input id="color" name="color" type="text" autoComplete="off" defaultValue={v?.color ?? ''} style={inputStyle} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="licensePlate" style={labelStyle}>
          License plate
        </label>
        <input
          id="licensePlate"
          name="licensePlate"
          type="text"
          required
          maxLength={20}
          autoComplete="off"
          defaultValue={v?.licensePlate ?? ''}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="seatCapacity" style={labelStyle}>
          Seat capacity
        </label>
        <input
          id="seatCapacity"
          name="seatCapacity"
          type="number"
          required
          min={1}
          max={8}
          defaultValue={v?.seatCapacity ?? ''}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="vehicleType" style={labelStyle}>
          Vehicle type
        </label>
        <select id="vehicleType" name="vehicleType" required defaultValue={v?.vehicleType ?? 'SEDAN'} style={inputStyle}>
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={saving} style={{ padding: '0.6rem 1.2rem', cursor: saving ? 'wait' : 'pointer' }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>

      <p style={{ marginTop: '1rem' }}>
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
    </form>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '0.25rem' };

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.5rem',
  boxSizing: 'border-box'
};
