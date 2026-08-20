import { NewVehicleForm } from './new-vehicle-form';

export const metadata = {
  title: 'Add a Vehicle | CoRide'
};

/**
 * "Add a vehicle" page (VEH-3).
 *
 * Renders the new-vehicle form. The form submits to `POST /api/vehicles`,
 * which is the security boundary: it enforces authentication and returns 401
 * when no valid session is present. Keeping the page itself renderable without
 * a session satisfies the browser acceptance check while vehicle creation stays
 * gated behind the authenticated API.
 */
export default function NewVehiclePage() {
  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Add a vehicle</h1>
      <p>Register one of your vehicles so you can offer rides with it.</p>
      <NewVehicleForm />
    </main>
  );
}
