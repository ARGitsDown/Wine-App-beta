// Vercel's Prisma Postgres storage integration currently names its
// connection string env vars after the resource (e.g. Database_DATABASE_URL)
// instead of the plain DATABASE_URL. Check the conventional name first so
// this keeps working if the database is ever moved to a provider that sets
// DATABASE_URL directly.
//
// Used by both prisma.config.ts (the Prisma CLI, e.g. `migrate deploy`) and
// lib/prisma.js (the running app) - kept in one place so they can't drift
// into resolving different connection strings.
export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.Database_DATABASE_URL ||
    process.env.Database_PRISMA_DATABASE_URL ||
    process.env.Database_POSTGRES_URL
  );
}
