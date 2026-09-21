import "server-only";
import { prisma } from "@/lib/prisma";

// Who the row being written belongs to.
//
// This function is the entire seam between a single-owner app and a
// multi-user one. Today it answers "the one owner there is"; in Phase 1 it
// answers "whoever is signed in" (FUTURE_CAPABILITIES.md). Every place that
// creates a bottle, a flight or a pairing already calls it, so that change
// is a change to this file and to nothing else - which is the point of
// doing Phase 0 on its own, ahead of any authentication.
//
// Not cached, deliberately. It is one primary-key-ish lookup on a table
// with a single row, and it is only ever called on a write - never in a
// list page's hot path - so the saving would be invisible. More
// importantly, a module-scope cache would be a landmine the moment this
// starts depending on a session: a cached value would leak one person's
// identity into another person's request, which is the single worst bug
// this whole plan could produce. Cheaper to never start.
export async function currentOwnerId() {
  const owner = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  // A missing owner is not something to paper over with a silent create:
  // the row is seeded by the migration, so its absence means the migration
  // did not run, and inventing a second owner here would quietly split the
  // cellar in two. Better to fail loudly at the write than to succeed into
  // a mess nobody can see.
  if (!owner) {
    throw new Error(
      "No owner row found. The 20260921170000_add_owner migration seeds one - run `prisma migrate deploy`."
    );
  }

  return owner.id;
}
