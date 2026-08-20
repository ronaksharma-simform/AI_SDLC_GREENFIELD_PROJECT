import cookieParser from 'cookie-parser';
import express, { Express, NextFunction, Request, Response } from 'express';
import { store } from './store';
import { publicUser } from './auth';
import { registerAuthRoutes } from './routes/auth';
import { registerVehicleRoutes } from './routes/vehicles';
import { renderVehiclesPage } from './pages/vehicles';

const SESSION_COOKIE = 'sid';

/** Builds the Express application (exported separately for supertest). */
export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Basic health check for readiness probes.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // Root redirects to the vehicles page.
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/vehicles');
  });

  registerAuthRoutes(app);
  registerVehicleRoutes(app);

  // /vehicles — server-rendered list page.
  app.get('/vehicles', (req: Request, res: Response) => {
    const token = (req.cookies && (req.cookies[SESSION_COOKIE] as string | undefined)) || undefined;
    const session = token ? store.findSession(token) : undefined;
    const user = session ? store.findUserById(session.userId) : undefined;
    const vehicles = user ? store.listVehiclesByUser(user.id) : [];
    res.type('html').send(renderVehiclesPage(user ? publicUser(user) : null, vehicles));
  });

  // /vehicles/add — minimal placeholder form page (target of the "Add" link).
  app.get('/vehicles/add', (_req: Request, res: Response) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Add Vehicle — CoRide</title></head>
<body><main><h1>Add Vehicle</h1><p data-testid="add-vehicle-page">Use POST /api/vehicles to create a vehicle.</p>
<p><a href="/vehicles">Back to My Vehicles</a></p></main></body></html>`);
  });

  // /vehicles/:id/edit — minimal placeholder page (target of each "Edit" link).
  app.get('/vehicles/:id/edit', (req: Request, res: Response) => {
    const id = req.params.id;
    res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Edit Vehicle — CoRide</title></head>
<body><main><h1>Edit Vehicle</h1><p data-testid="edit-vehicle-page">Vehicle id: ${encodeURIComponent(id)}</p>
<p><a href="/vehicles">Back to My Vehicles</a></p></main></body></html>`);
  });

  // 404 for unknown API routes.
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
  });

  // Central error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export default createApp;
