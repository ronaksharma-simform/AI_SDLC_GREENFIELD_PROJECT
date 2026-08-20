import { Express, Response, Router } from 'express';
import { store } from '../store';
import { AuthenticatedRequest, requireAuth } from '../auth';

const MIN_YEAR = 1886;

export function registerVehicleRoutes(app: Express): void {
  const router = Router();

  // GET /api/vehicles — the session user's vehicles, newest first
  router.get('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user as NonNullable<typeof req.user>;
    const vehicles = store.listVehiclesByUser(user.id);
    res.status(200).json({ vehicles });
  });

  // POST /api/vehicles — create a vehicle for the session user
  router.post('/', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user as NonNullable<typeof req.user>;
    const body = (req.body ?? {}) as Record<string, unknown>;

    const make = typeof body.make === 'string' ? body.make.trim() : '';
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    const rawYear = typeof body.year === 'number' ? body.year : Number(body.year);
    const color = typeof body.color === 'string' && body.color.trim() !== '' ? body.color.trim() : undefined;

    const errors: string[] = [];
    if (!make) errors.push('make is required');
    if (!model) errors.push('model is required');
    if (!Number.isInteger(rawYear) || rawYear < MIN_YEAR || rawYear > new Date().getFullYear() + 1) {
      errors.push(`year must be an integer between ${MIN_YEAR} and ${new Date().getFullYear() + 1}`);
    }
    if (errors.length > 0) {
      res.status(400).json({ error: 'Validation failed', details: errors });
      return;
    }

    const vehicle = store.createVehicle({ userId: user.id, make, model, year: rawYear, color });
    res.status(201).json({ vehicle });
  });

  app.use('/api/vehicles', router);
}
