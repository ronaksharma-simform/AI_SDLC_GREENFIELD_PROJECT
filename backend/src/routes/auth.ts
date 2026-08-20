import { Express, Response, Router } from 'express';
import { store } from '../store';
import { AuthenticatedRequest, hashPassword, publicUser, requireAuth, verifyPassword } from '../auth';

const SESSION_COOKIE = 'sid';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function registerAuthRoutes(app: Express): void {
  const router = Router();

  // POST /api/auth/register — create a user account
  router.post('/register', (req, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }
    if (store.findUserByEmail(email)) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const user = store.createUser(email, hashPassword(password));
    res.status(201).json({ user: publicUser(user) });
  });

  // POST /api/auth/login — start a session (sets the sid cookie)
  router.post('/login', (req, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const user = store.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const session = store.createSession(user.id);
    res.cookie(SESSION_COOKIE, session.token, { httpOnly: true, sameSite: 'lax', path: '/' });
    res.status(200).json({ user: publicUser(user) });
  });

  // POST /api/auth/logout — destroy the session
  router.post('/logout', (req, res: Response) => {
    const token = req.cookies && (req.cookies[SESSION_COOKIE] as string | undefined);
    if (token) store.deleteSession(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  // GET /api/auth/me — current session user
  router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({ user: publicUser(req.user as NonNullable<typeof req.user>) });
  });

  app.use('/api/auth', router);
}
