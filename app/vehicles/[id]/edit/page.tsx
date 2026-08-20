import { EditVehicleForm } from './edit-vehicle-form';

export const metadata = {
  title: 'Edit Vehicle | CoRide'
};

/**
 * "Edit a vehicle" page (VEH-5).
 *
 * Renders the edit form for the vehicle identified by `params.id`. The form is
 * a client component that loads the current vehicle data from
 * `GET /api/vehicles/[id]` and saves changes with `PATCH /api/vehicles/[id]`.
 *
 * The page itself is kept renderable without a session or database so it always
 * produces a usable form (including its submit button); ownership is enforced by
 * the API layer (VEH-7), which returns 404 for vehicles that do not belong to
 * the signed-in user.
 */
export default async function EditVehiclePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Edit vehicle</h1>
      <p>Update the details of your vehicle below.</p>
      <EditVehicleForm vehicleId={id} />
    </main>
  );
}
