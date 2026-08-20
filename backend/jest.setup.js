// Env defaults so the strict config module (and app) can load under Jest
// without a real .env or database. Real env vars are never overwritten.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/coride';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
