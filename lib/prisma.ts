import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

/**
 * Prisma client singleton.
 *
 * Before instantiating the client we load the project-local `.env` file with
 * `override: true`. This guarantees the app talks to the CoRide database even
 * when the process was started with `DATABASE_URL` inherited from the host
 * environment (e.g. the AI-SDLC platform's own database). A project-local
 * `.env` deliberately takes precedence over inherited variables.
 *
 * In development the client is cached on `globalThis` so hot reloading does not
 * exhaust database connections. In production a fresh client per process is the
 * intended, safe behaviour.
 */
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
