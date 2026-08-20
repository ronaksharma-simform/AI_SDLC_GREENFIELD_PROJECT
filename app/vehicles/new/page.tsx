import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { NewVehicleForm } from './new-vehicle-form';

export const metadata = {
  title: 'Add a Vehicle | CoRide'
};

/**
 * Protected "Add a vehicle" page (VEH-3).
 *
 * The root `middleware.ts` already gates `/vehicles` behind a valid JWT, but
 * this server-side check is defence in depth: if a session is somehow absent it
 * redirects to `/login` rather than rendering a broken form.
 */
export default async function NewVehiclePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Add a vehicle</h1>
      <p>Register one of your vehicles so you can offer rides with it.</p>
      <NewVehicleForm />
    </main>
  );
}
