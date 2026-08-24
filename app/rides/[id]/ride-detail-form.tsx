'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LocationPicker, type LocationValue } from '@/components/location-picker';
import { paiseToRupees, rupeesToPaise } from '@/lib/format-money';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';

interface VehicleOption {
  id: string;
  label: string;
  seatCapacity: number;
}

interface RideDetail {
  id: string;
  sourceLatitude?: number | string | null;
  sourceLongitude?: number | string | null;
  sourceAddress: string;
  destinationLatitude?: number | string | null;
  destinationLongitude?: number | string | null;
  destinationAddress: string;
  departureTime: string;
  seatsTotal: number;
  seatsAvailable: number;
  status: string;
  notes: string | null;
  totalCost?: number | null;
  vehicleId: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    licensePlate: string;
    seatCapacity: number;
  };
}

interface RideResponse {
  ok: boolean;
  ride?: RideDetail;
  error?: string;
  details?: Record<string, string[]>;
}

/** Converts an ISO timestamp to the `datetime-local` input value (local time). */
function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Builds a picker value from a ride's stored location fields (if coordinates exist). */
function toLocation(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
  address: string
): LocationValue | null {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng, address };
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

export function RideDetailForm({
  ride,
  vehicles,
  locked
}: {
  ride: RideDetail;
  vehicles: VehicleOption[];
  locked: boolean;
}) {
  const router = useRouter();

  const [vehicleId, setVehicleId] = useState(ride.vehicleId);
  const [source, setSource] = useState<LocationValue | null>(() =>
    toLocation(ride.sourceLatitude, ride.sourceLongitude, ride.sourceAddress)
  );
  const [destination, setDestination] = useState<LocationValue | null>(() =>
    toLocation(ride.destinationLatitude, ride.destinationLongitude, ride.destinationAddress)
  );
  const [departureTime, setDepartureTime] = useState(toDatetimeLocal(ride.departureTime));
  const [seatsTotal, setSeatsTotal] = useState(ride.seatsTotal);
  const [notes, setNotes] = useState(ride.notes ?? '');
  const [totalCost, setTotalCost] = useState(
    ride.totalCost != null && ride.totalCost > 0 ? paiseToRupees(ride.totalCost).toString() : ''
  );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const cancelled = ride.status === 'CANCELLED' || ride.status === 'COMPLETED';
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors(null);
    setSuccess(null);
    setLoading(true);

    const payload: Record<string, unknown> = {
      notes: notes.trim() || null
    };
    if (source) payload.source = toLocationPayload(source);
    if (destination) payload.destination = toLocationPayload(destination);
    if (!locked) {
      payload.vehicleId = vehicleId;
      payload.departureTime = departureTime;
      payload.seatsTotal = seatsTotal;
    }

    // Trip cost stays editable while the ride is locked by accepted seats
    // (PAY-1) but is immutable once the ride is completed/cancelled.
    if (!cancelled) {
      const totalCostValue = totalCost.trim();
      payload.totalCost = totalCostValue ? rupeesToPaise(Number(totalCostValue)) : null;
    }

    try {
      const res = await fetch(`/api/rides/${ride.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const body: RideResponse = await res.json();
      if (res.ok && body.ok && body.ride) {
        setSuccess('Ride updated.');
        setSource(
          toLocation(body.ride.sourceLatitude, body.ride.sourceLongitude, body.ride.sourceAddress)
        );
        setDestination(
          toLocation(
            body.ride.destinationLatitude,
            body.ride.destinationLongitude,
            body.ride.destinationAddress
          )
        );
        setNotes(body.ride.notes ?? '');
        setVehicleId(body.ride.vehicleId);
        setDepartureTime(toDatetimeLocal(body.ride.departureTime));
        setSeatsTotal(body.ride.seatsTotal);
        router.refresh();
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

  async function handleComplete() {
    setCompleteOpen(false);
    setError(null);
    setSuccess(null);
    setCompleting(true);

    try {
      const res = await fetch(`/api/rides/${ride.id}/complete`, {
        method: 'POST'
      });

      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const body: RideResponse = await res.json();
      if (res.ok && body.ok) {
        setSuccess('Ride completed.');
        router.refresh();
      } else {
        setError(body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setCompleting(false);
    }
  }

  async function handleCancel() {
    setCancelOpen(false);
    setError(null);
    setSuccess(null);
    setCancelling(true);

    try {
      const res = await fetch(`/api/rides/${ride.id}`, {
        method: 'DELETE'
      });

      if (res.status === 401) {
        setError('Your session expired. Please sign in again.');
        return;
      }

      const body: RideResponse = await res.json();
      if (res.ok && body.ok) {
        setSuccess('Ride cancelled.');
        router.refresh();
      } else {
        setError(body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Network error — please try again.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <form onSubmit={handleSave} noValidate className="space-y-5">
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
          disabled={locked || cancelled}
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
        disabled={cancelled}
        initialAddress={ride.sourceAddress}
        hint="Pick up location"
      />

      <LocationPicker
        id="destination"
        label="Destination"
        value={destination}
        onChange={setDestination}
        errors={fieldErrors?.destination}
        disabled={cancelled}
        initialAddress={ride.destinationAddress}
        hint="Drop off location"
      />

      <Field label="Departure time" htmlFor="departureTime" required errors={fieldErrors?.departureTime}>
        <Input
          id="departureTime"
          name="departureTime"
          type="datetime-local"
          required
          disabled={locked || cancelled}
          value={departureTime}
          onChange={(event) => setDepartureTime(event.target.value)}
          aria-invalid={fieldErrors?.departureTime ? true : undefined}
        />
      </Field>

      <Field
        label="Seats offered"
        htmlFor="seatsTotal"
        required
        errors={fieldErrors?.seatsTotal}
      >
        <Input
          id="seatsTotal"
          name="seatsTotal"
          type="number"
          required
          min={1}
          max={selectedVehicle?.seatCapacity ?? ride.vehicle.seatCapacity}
          disabled={locked || cancelled}
          value={seatsTotal}
          onChange={(event) => setSeatsTotal(Number(event.target.value))}
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
          disabled={cancelled}
          value={totalCost}
          onChange={(event) => setTotalCost(event.target.value)}
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
          disabled={cancelled}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          aria-invalid={fieldErrors?.notes ? true : undefined}
        />
      </Field>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={loading || cancelled} size="lg">
          {loading ? 'Saving…' : 'Save changes'}
        </Button>

        {!cancelled && ride.status === 'IN_PROGRESS' ? (
          <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="lg" disabled={completing}>
                {completing ? 'Completing…' : 'Mark complete'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Complete this ride?</AlertDialogTitle>
                <AlertDialogDescription>
                  This closes the ride, stops location sharing, and closes its
                  chat conversations. Message history stays available but no new
                  messages can be sent.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not yet</AlertDialogCancel>
                <AlertDialogAction onClick={handleComplete}>
                  Mark complete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {!cancelled ? (
          <>
            <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="lg" disabled={cancelling}>
                  {cancelling ? 'Cancelling…' : 'Cancel ride'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this ride?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This cannot be undone. Riders who have requested seats will be notified.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep ride</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Cancel ride
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : null}
      </div>
    </form>
  );
}
