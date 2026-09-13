import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Next.js reloads modules on every code change in dev. Without this cache,
// each reload would open a brand new database connection and leak the old
// one. Stashing the client on `global` keeps the same connection across
// reloads; production only ever creates it once anyway.
const globalForPrisma = globalThis;

// SQLite is only for local development (see PROJECT.md). When production
// moves to a hosted Postgres database, swap this adapter for
// @prisma/adapter-pg, pointed at the same DATABASE_URL.
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
