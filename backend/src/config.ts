import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/**
 * Single source of truth for all environment configuration.
 *
 * On import, this module:
 *   1. Loads variables from a `.env` file (if present) into `process.env`.
 *   2. Validates every required variable.
 *   3. Applies defaults where the spec allows them (currently: PORT).
 *   4. If anything is missing or invalid, prints a clear, actionable error
 *      naming exactly which variable(s) are wrong (and whether `.env` itself
 *      is missing), then exits the process with a non-zero code.
 *
 * Import `config` from this module everywhere instead of reading
 * `process.env` directly, so the whole app shares one validated source of
 * truth and fails fast at startup rather than failing later at first use.
 */

export interface AppConfig {
  /** PostgreSQL connection string. Required, no default. */
  databaseUrl: string;
  /** Port the HTTP server listens on. Optional — defaults to 3000. */
  port: number;
  /** Pino log level. Required, no default. */
  logLevel: string;
  /** Node environment. Optional — defaults to "development". */
  nodeEnv: string;
}

const DEFAULT_PORT = 3000;
const DEFAULT_NODE_ENV = 'development';
const VALID_LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

interface FieldError {
  variable: string;
  problem: string;
}

/**
 * Loads `.env` (from the current working directory) into `process.env`,
 * if it exists. Returns whether the file was found, so callers can surface
 * an accurate error message ("no .env file" vs. "invalid value in .env").
 *
 * Deliberately does NOT throw or exit if `.env` is absent: env vars may
 * legitimately be supplied another way (shell export, Docker, CI secrets).
 * The absence is instead reported as context if validation fails below.
 */
function loadDotenv(envPath: string): boolean {
  const envFileExists = fs.existsSync(envPath);
  dotenv.config({ path: envPath });
  return envFileExists;
}

function validateDatabaseUrl(errors: FieldError[]): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (raw === undefined || raw.trim() === '') {
    errors.push({ variable: 'DATABASE_URL', problem: 'is required but was not set.' });
    return undefined;
  }

  const value = raw.trim();
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    errors.push({
      variable: 'DATABASE_URL',
      problem:
        `must be a valid connection URL, e.g. "postgresql://user:password@localhost:5432/coride" (got "${value}").`,
    });
    return undefined;
  }

  return value;
}

function validatePort(errors: FieldError[]): number | undefined {
  const raw = process.env.PORT;
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PORT;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    errors.push({
      variable: 'PORT',
      problem: `must be an integer between 1 and 65535 (got "${raw}"). Leave it unset to use the default of ${DEFAULT_PORT}.`,
    });
    return undefined;
  }

  return parsed;
}

function validateLogLevel(errors: FieldError[]): string | undefined {
  const raw = process.env.LOG_LEVEL;
  if (raw === undefined || raw.trim() === '') {
    errors.push({ variable: 'LOG_LEVEL', problem: 'is required but was not set.' });
    return undefined;
  }

  const value = raw.trim().toLowerCase();
  if (!(VALID_LOG_LEVELS as readonly string[]).includes(value)) {
    errors.push({
      variable: 'LOG_LEVEL',
      problem: `must be one of: ${VALID_LOG_LEVELS.join(', ')} (got "${raw}").`,
    });
    return undefined;
  }

  return value;
}

function reportAndExit(errors: FieldError[], envFileExists: boolean, envPath: string): never {
  const lines: string[] = [
    '',
    '\u2716 Invalid or missing environment configuration. The app cannot start.',
    '',
    ...errors.map((err) => `  - ${err.variable}: ${err.problem}`),
    '',
  ];

  if (!envFileExists) {
    lines.push(`No .env file was found at: ${envPath}`);
    lines.push('This is almost certainly the cause of the error(s) above.');
  } else {
    lines.push(`A .env file was found at: ${envPath}`);
    lines.push('but one or more values in it are missing or invalid (see above).');
  }

  lines.push(
    '',
    'To fix this:',
    '  1. Copy the example file if you have not already:',
    '       cp backend/.env.example backend/.env',
    '  2. Open backend/.env and set each variable listed above.',
    '  3. Restart the application.',
    ''
  );

  // eslint-disable-next-line no-console
  console.error(lines.join('\n'));
  process.exit(1);
}

function loadConfig(): AppConfig {
  const envPath = path.resolve(process.cwd(), '.env');
  const envFileExists = loadDotenv(envPath);

  const errors: FieldError[] = [];
  const databaseUrl = validateDatabaseUrl(errors);
  const port = validatePort(errors);
  const logLevel = validateLogLevel(errors);
  const nodeEnv = (process.env.NODE_ENV && process.env.NODE_ENV.trim()) || DEFAULT_NODE_ENV;

  if (errors.length > 0 || databaseUrl === undefined || port === undefined || logLevel === undefined) {
    reportAndExit(errors, envFileExists, envPath);
  }

  return { databaseUrl, port, logLevel, nodeEnv };
}

/** The single, validated configuration object \u2014 import this everywhere. */
export const config: AppConfig = loadConfig();

export default config;
