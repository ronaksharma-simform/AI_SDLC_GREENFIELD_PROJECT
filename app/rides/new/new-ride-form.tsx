'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LocationPicker, type LocationValue } from '@/components/location-picker';
import { rupeesToPaise } from '@/lib/format-money';

interface VehicleOption {
  id: string;
  label: string;
  seatCapacity: number;
}

interface RideResponse {
  ok: boolean;
  ride?: { id: string; sourceAddress: string; destinationAddress: string };
  error?: string;
  message?: string;
  details?: Record<string, string[]>;
}

function toLocationPayload(location: LocationValue | null) {
  if (!location) return null;
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    address: location.address,
    ...(location.placeId ? { placeId: location.placeId } : {})
  };
}

export function NewRideForm({ vehicles }: { vehicles: VehicleOption[] }) {
  const firstVehicle = vehicles[0];
  const [vehicleId, setVehicleId] = useState(firstVehicle?.id ?? '');
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) ?? firstVehicle;

  const [source, setSource] = useState<LocationValue | null>(null);
  const [destination, setDestination] = useState<LocationValue | null>(null);

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

    const totalCostValue = String(formData.get('totalCost') ?? '').trim();

    const payload: Record<string, unknown> = {
      vehicleId: String(formData.get('vehicleId') ?? ''),
      source: toLocationPayload(source),
      destination: toLocationPayload(destination),
      departureTime: String(formData.get('departureTime') ?? ''),
      seatsTotal: Number(formData.get('seatsTotal')),
      notes: String(formData.get('notes') ?? '').trim() || undefined
    };

    // Optional trip cost in rupees (PAY-1); the API stores it in paise.
    if (totalCostValue) {
      payload.totalCost = rupeesToPaise(Number(totalCostValue));
    }

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
          `Ride from ${body.ride?.sourceAddress ?? ''} to ${body.ride?.destinationAddress ?? ''} was published.`
        );
        form.reset();
        setSource(null);
        setDestination(null);
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

      <Field label="Vehicle" htmlFor="vehicleId" required errors={fieldErrors?.vehicleId}>
        <Select
          id="vehicleId"
          name="vehicleId"
          required
          value={vehicleId}
          onChange={(event) => setVehicleId(event.target.value)}
          aria-invalid={fieldErrors?.vehicleId ? true : undefined}
        >
          {vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.label}
            </option>
          ))}
        </Select>
      </Field>

      <LocationPicker
        id="source"
        label="Source"
        value={source}
        onChange={setSource}
        errors={fieldErrors?.source}
        hint="Pick up location"
      />

      <LocationPicker
        id="destination"
        label="Destination"
        value={destination}
        onChange={setDestination}
        errors={fieldErrors?.destination}
        hint="Drop off location"
      />

      <Field label="Departure time" htmlFor="departureTime" required errors={fieldErrors?.departureTime}>
        <Input
          id="departureTime"
          name="departureTime"
          type="datetime-local"
          required
          aria-invalid={fieldErrors?.departureTime ? true : undefined}
        />
      </Field>

      <Field
        label="Seats to offer"
        htmlFor="seatsTotal"
        required
        hint={
          selectedVehicle
            ? `Your ${selectedVehicle.label} has ${selectedVehicle.seatCapacity} seats.`
            : undefined
        }
        errors={fieldErrors?.seatsTotal}
      >
        <Input
          id="seatsTotal"
          name="seatsTotal"
          type="number"
          required
          min={1}
          max={selectedVehicle?.seatCapacity ?? 1}
          defaultValue={selectedVehicle?.seatCapacity ?? 1}
          aria-invalid={fieldErrors?.seatsTotal ? true : undefined}
        />
      </Field>

      <Field
        label="Trip cost"
        htmlFor="totalCost"
        hint="Optional — total fare in ₹. Split equally per person once seats are confirmed."
        errors={fieldErrors?.totalCost}
      >
        <Input
          id="totalCost"
          name="totalCost"
          type="number"
          min={0.01}
          step={0.01}
          placeholder="e.g. 120"
          aria-invalid={fieldErrors?.totalCost ? true : undefined}
        />
      </Field>

      <Field
        label="Notes"
        htmlFor="notes"
        hint="Optional — e.g. meeting point, luggage rules."
        errors={fieldErrors?.notes}
      >
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={280}
          placeholder="e.g. meeting point, luggage rules"
          aria-invalid={fieldErrors?.notes ? true : undefined}
        />
      </Field>

      <Button type="submit" disabled={loading} size="lg" className="w-full sm:w-auto">
        {loading ? 'Publishing…' : 'Offer ride'}
      </Button>
    </form>
  );
}
