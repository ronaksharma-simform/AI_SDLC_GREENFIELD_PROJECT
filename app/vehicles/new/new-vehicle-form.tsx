'use client';

import { useState } from 'react';
import Link from 'next/link';

interface VehicleResponse {
  ok: boolean;
  vehicle?: { id: string; licensePlate: string };
  error?: string;
  message?: string;
  details?: Record<string, string[]>;
}

const VEHICLE_TYPES = ['SEDAN', 'SUV', 'HATCHBACK', 'VAN', 'COUPE', 'CONVERTIBLE', 'TRUCK', 'OTHER'] as const;

export function NewVehicleForm() {
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
      make: String(formData.get('make') ?? '').trim(),
      model: String(formData.get('model') ?? '').trim(),
      year: Number(formData.get('year')),
      color: String(formData.get('color') ?? '').trim() || undefined,
      licensePlate: String(formData.get('licensePlate') ?? '').trim(),
      seatCapacity: Number(formData.get('seatCapacity')),
      vehicleType: String(formData.get('vehicleType') ?? '')
    };

    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const body: VehicleResponse = await res.json();
      if (res.ok && body.ok) {
        setSuccess(
          `Vehicle with plate ${body.vehicle?.licensePlate ?? ''} was added successfully.`
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
        <label htmlFor="make" style={labelStyle}>
          Make
        </label>
        <input id="make" name="make" type="text" required autoComplete="off" style={inputStyle} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="model" style={labelStyle}>
          Model
        </label>
        <input id="model" name="model" type="text" required autoComplete="off" style={inputStyle} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="year" style={labelStyle}>
          Year
        </label>
        <input id="year" name="year" type="number" required min={1900} max={2100} style={inputStyle} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="color" style={labelStyle}>
          Color
        </label>
        <input id="color" name="color" type="text" autoComplete="off" style={inputStyle} />
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
          style={inputStyle}
        />
        {fieldErrors?.licensePlate?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
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
          style={inputStyle}
        />
        {fieldErrors?.seatCapacity?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="vehicleType" style={labelStyle}>
          Vehicle type
        </label>
        <select id="vehicleType" name="vehicleType" required style={inputStyle}>
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        {fieldErrors?.vehicleType?.map((message) => (
          <small key={message} style={{ color: '#b00020', display: 'block' }}>
            {message}
          </small>
        ))}
      </div>

      <button type="submit" disabled={loading} style={{ padding: '0.6rem 1.2rem', cursor: loading ? 'wait' : 'pointer' }}>
        {loading ? 'Saving…' : 'Add vehicle'}
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
