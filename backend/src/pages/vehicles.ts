import { Vehicle } from '../store';

export interface PublicUserView {
  id: string;
  email: string;
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Server-rendered /vehicles page.
 *
 * Always renders the `data-testid="vehicle-list"` container plus the
 * add/edit links. When the caller is authenticated the list is populated
 * server-side; otherwise the container is empty and the page prompts to log in.
 */
export function renderVehiclesPage(user: PublicUserView | null, vehicles: Vehicle[]): string {
  const rows = vehicles
    .map(
      (v) => `
        <li class="vehicle-item" data-testid="vehicle-item">
          <span class="vehicle-title">${escapeHtml(v.year)} ${escapeHtml(v.make)} ${escapeHtml(v.model)}</span>
          <a href="/vehicles/${encodeURIComponent(v.id)}/edit" data-testid="edit-vehicle-link">Edit</a>
        </li>`
    )
    .join('');

  const listSection = user
    ? `
      <p class="welcome">Welcome, ${escapeHtml(user.email)}</p>
      <ul data-testid="vehicle-list">${rows}</ul>`
    : `
      <p class="welcome">Log in to see your vehicles.</p>
      <ul data-testid="vehicle-list"></ul>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>My Vehicles — CoRide</title>
</head>
<body>
  <main class="vehicles-page">
    <h1>My Vehicles</h1>
    <p class="actions">
      <a href="/vehicles/add" data-testid="add-vehicle-link">Add vehicle</a>
    </p>
    ${listSection}
    <p class="nav"><a href="/">Home</a></p>
  </main>
</body>
</html>`;
}
