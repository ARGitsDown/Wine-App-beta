import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js reloads modules on every code change in dev. Without this cache,
// each reload would open a brand new database connection and leak the old
// one. Stashing the client on `global` keeps the same connection across
// reloads; production only ever creates it once anyway.
const globalForPrisma = globalThis;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
