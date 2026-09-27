-- The estate's tagline, shown alongside domaineName (see that migration
-- and the schema comment on User.domaineMotto). Nullable for the same
-- reason: optional, and every existing row predates it.

ALTER TABLE "User" ADD COLUMN "domaineMotto" TEXT;
