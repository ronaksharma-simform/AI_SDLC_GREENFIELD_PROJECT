'use client';

import { useState } from 'react';

interface VehicleOption {
  id: string;
  label: string;
  seatCapacity: number;
}

interface RideResponse {
  ok: boolean;
  ride?: { id: string; source: string; destination: string };
  error?: string;
  message?: string;
  details?: Record<string, string[]>;
}

export function NewRideForm({ vehicles }: { vehicles: VehicleOption[] }) {
  const firstVehicle = vehicles[0];
  const [vehicleId, setVehicleId] = useState(firstVehicle?.id ?? '');
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? firstVehicle;

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors(null);
    setSuccess(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      vehicleId: String(formData.get('vehicleId') ?? ''),
      source: String(formData.get('source') ?? '').trim(),
      destination: String(formData.get('destination') ?? '').trim(),
      departureTime: String(formData.get('departureTime') ?? ''),
      seatsTotal: Number(formData.get('seatsTotal')),
      notes: String(formData.get('notes') ?? '').trim() || undefined
    };

    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const body: RideResponse = await res.json();
      if (res.ok && body.ok) {
        setSuccess(
          `Ride from ${body.ride?.source ?? ''} to ${body.ride?.destination ?? ''} was published.`
        );
        form.reset();
      } else if (res.status === 400 && body.details) {
        setFieldErrors(body.details);
        setError(body.error ?? 'Please fix the highlighted fields.');
      } else {
        setError(body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <p role="alert" style={{ color: '#b00020' }}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" style={{ color: '#1e7d34' }}>
          {success}
        </p>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="vehicleId" style={labelStyle}>
          Vehicle
        </label>
        <select
          id="vehicleId"
          name="vehicleId"
          required
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
          style={inputStyle}
        >
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.label}
            </option>
          ))}
        </select>
        {fieldErrors?.vehicleId?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="source" style={labelStyle}>
          Source
        </label>
        <input id="source" name="source" type="text" required minLength={2} autoComplete="off" style={inputStyle} />
        {fieldErrors?.source?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="destination" style={labelStyle}>
          Destination
        </label>
        <input id="destination" name="destination" type="text" required minLength={2} autoComplete="off" style={inputStyle} />
        {fieldErrors?.destination?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="departureTime" style={labelStyle}>
          Departure time
        </label>
        <input id="departureTime" name="departureTime" type="datetime-local" required style={inputStyle} />
        {fieldErrors?.departureTime?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="seatsTotal" style={labelStyle}>
          Seats to offer
        </label>
        <input
          id="seatsTotal"
          name="seatsTotal"
          type="number"
          required
          min={1}
          max={selectedVehicle?.seatCapacity ?? 1}
          defaultValue={selectedVehicle?.seatCapacity ?? 1}
          style={inputStyle}
        />
        <small style={{ color: '#555' }}>
          {selectedVehicle ? `Your ${selectedVehicle.label} has ${selectedVehicle.seatCapacity} seats.` : ''}
        </small>
        {fieldErrors?.seatsTotal?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="notes" style={labelStyle}>
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={280}
          placeholder="e.g. meeting point, luggage rules"
          style={inputStyle}
        />
        {fieldErrors?.notes?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <button type="submit" disabled={loading} style={{ padding: '0.6rem 1.2rem', cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? 'Publishing…' : 'Offer ride'}
      </button>
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
