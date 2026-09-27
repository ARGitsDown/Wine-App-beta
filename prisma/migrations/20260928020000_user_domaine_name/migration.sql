-- "Name your Domaine" - the estate's own name, distinct from the person's
-- own `name`. Nullable: every existing User predates this, and naming an
-- estate is optional. See the schema comment on User.domaineName for why
-- this lives here rather than on a dedicated Domaine table, which doesn't
-- exist yet.

ALTER TABLE "User" ADD COLUMN "domaineName" TEXT;
