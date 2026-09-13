import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js reloads modules on every code change in dev. Without this cache,
// each reload would open a brand new database connection and leak the old
// one. Stashing the client on `global` keeps the same connection across
// reloads; production only ever creates it once anyway.
const globalForPrisma = globalThis;

// Vercel's Prisma Postgres storage integration currently names its
// connection string env vars after the resource (e.g.
// Database_DATABASE_URL) instead of the plain DATABASE_URL. Check the
// conventional name first so this keeps working if the database is ever
// moved to a provider that sets DATABASE_URL directly.
const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.Database_DATABASE_URL ||
  process.env.Database_PRISMA_DATABASE_URL ||
  process.env.Database_POSTGRES_URL;

const adapter = new PrismaPg({ connectionString: databaseUrl });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
