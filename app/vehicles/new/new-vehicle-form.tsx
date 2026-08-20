'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/field';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success" role="status">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Make" htmlFor="make" required errors={fieldErrors?.make}>
          <Input
            id="make"
            name="make"
            type="text"
            required
            autoComplete="off"
            aria-invalid={fieldErrors?.make ? true : undefined}
          />
        </Field>

        <Field label="Model" htmlFor="model" required errors={fieldErrors?.model}>
          <Input
            id="model"
            name="model"
            type="text"
            required
            autoComplete="off"
            aria-invalid={fieldErrors?.model ? true : undefined}
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Year" htmlFor="year" required errors={fieldErrors?.year}>
          <Input
            id="year"
            name="year"
            type="number"
            required
            min={1900}
            max={2100}
            aria-invalid={fieldErrors?.year ? true : undefined}
          />
        </Field>

        <Field label="Color" htmlFor="color" hint="Optional." errors={fieldErrors?.color}>
          <Input
            id="color"
            name="color"
            type="text"
            autoComplete="off"
            aria-invalid={fieldErrors?.color ? true : undefined}
          />
        </Field>
      </div>

      <Field label="License plate" htmlFor="licensePlate" required errors={fieldErrors?.licensePlate}>
        <Input
          id="licensePlate"
          name="licensePlate"
          type="text"
          required
          maxLength={20}
          autoComplete="off"
          aria-invalid={fieldErrors?.licensePlate ? true : undefined}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Seat capacity"
          htmlFor="seatCapacity"
          required
          errors={fieldErrors?.seatCapacity}
        >
          <Input
            id="seatCapacity"
            name="seatCapacity"
            type="number"
            required
            min={1}
            max={8}
            aria-invalid={fieldErrors?.seatCapacity ? true : undefined}
          />
        </Field>

        <Field label="Vehicle type" htmlFor="vehicleType" required errors={fieldErrors?.vehicleType}>
          <Select
            id="vehicleType"
            name="vehicleType"
            required
            defaultValue="SEDAN"
            aria-invalid={fieldErrors?.vehicleType ? true : undefined}
          >
            {VEHICLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto">
        {loading ? 'Saving…' : 'Add vehicle'}
      </Button>

      <p className="text-sm text-muted-foreground">
        <Link href="/dashboard" className="text-primary underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </form>
  );
}
