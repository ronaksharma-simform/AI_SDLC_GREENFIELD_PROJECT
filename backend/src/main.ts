// Ensure the strict config module can validate even when no .env is present.
// These defaults are overridden by any real environment variables / .env file.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/coride';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Deliberately a runtime require (not a hoisted import) so the defaults above
// are set before the config module is evaluated.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { config } = require('./config') as typeof import('./config');

import { Server } from 'http';
import { createApp } from './app';

const app = createApp();

// Fallback ports to try when the configured port is already in use (the shared
// dev container reserves some ports, so a robust bind is required).
const FALLBACK_PORTS = [3000, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

function isEaddrinuse(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'EADDRINUSE';
}

function listen(port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once('error', reject);
  });
}

async function start(): Promise<void> {
  const candidates = [config.port, ...FALLBACK_PORTS.filter((p) => p !== config.port)];

  for (const port of candidates) {
    try {
      const server = await listen(port);
      // eslint-disable-next-line no-console
      console.log(`[coride] API listening on http://localhost:${port}`);

      const shutdown = (): void => {
        server.close(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      return;
    } catch (err) {
      if (isEaddrinuse(err)) {
        // eslint-disable-next-line no-console
        console.warn(`[coride] port ${port} is in use, trying next...`);
        continue;
      }
      throw err;
    }
  }

  // eslint-disable-next-line no-console
  console.error('[coride] no free port available; exiting.');
  process.exit(1);
}

void start();
