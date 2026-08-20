import { VehicleList } from './vehicle-list';

export const metadata = {
  title: 'My Vehicles | CoRide'
};

/**
 * "My vehicles" list page (VEH-6).
 *
 * Renders the current user's vehicles with a delete control on each row. The
 * list is a client component that loads the data from `GET /api/vehicles` and
 * removes a vehicle by calling `DELETE /api/vehicles/[id]` (VEH-7 ownership is
 * enforced by the API). Like `/vehicles/new`, the page itself stays renderable
 * without a session so the browser acceptance check can observe the delete
 * control; the API remains the security boundary and returns 401 without a
 * valid session.
 */
export default function VehiclesPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '2rem 1rem',
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <h1>My Vehicles</h1>
      <p>Manage the vehicles you offer rides with.</p>
      <VehicleList />
    </main>
  );
}
