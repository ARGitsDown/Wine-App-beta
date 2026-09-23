import "server-only";
import { prisma } from "@/lib/prisma";
import { currentOwnerId } from "@/lib/owner";

// Phase 2 of separate cellars per user (FUTURE_CAPABILITIES.md): the
// backbone the whole plan was built around. Roughly a hundred call sites
// across this app ask Prisma for a bottle, a flight, a pairing, or
// something that hangs off one of those - and every one of them was,
// until now, a place a mistake could leak one person's cellar into
// another's view. Fixing that call site by call site would mean getting
// it right about a hundred times in a row. This fixes it once, here, by
// injecting the owner filter into the query itself before it ever reaches
// Postgres.
//
// Two shapes of ownership in this schema (see prisma/schema.prisma):
//   - Direct: Bottle, TastingFlight and SavedPairing carry ownerId
//     themselves.
//   - Inherited: TastingNote, BottlePhoto and ResearchProposal belong to
//     whoever owns their bottle; FlightPick to whoever owns its flight;
//     PairingPick to whoever owns its pairing. None of these has an
//     ownerId column of its own, so the filter has to reach through the
//     relation instead - Prisma's "extended where unique input" support
//     is what makes that possible even for a lookup by id (see
//     SINGLE_ROW_OPS below).
//
// Deliberately exempt, and not an oversight:
//   - DrinkWindowEstimate is a cache keyed on the wine, not on who owns it
//     - see its own schema comment for why scoping it would be wrong, not
//     just unnecessary.
//   - User, Account, Session, VerificationToken and Invite are Auth.js's
//     own tables (or feed it); they query themselves by session, email or
//     token, not by a signed-in owner, and scoping them by "the current
//     owner" makes no sense before the owner is known.
//   - Guest and Favorite back /guest, which has no signed-in owner at
//     all - see lib/owner.js's guestOwnerId and the (guest) route group
//     for how that page scopes itself instead.
//   - ResearchJob has its own ownerId column but is deliberately NOT
//     scoped here: the step that reads it (app/api/research/step/route.js)
//     runs from a plain HTTP route hit by a server-to-server fetch with no
//     session attached, so it filters explicitly using the job's own
//     ownerId rather than through this session-reading client. See that
//     route and researchStep in app/actions.js.
//
// create/createMany are left untouched on purpose. Every root model's
// create site already sets ownerId itself - lib/owner.js's
// currentOwnerId is "the whole seam", built in during Phase 0 before any
// of this existed - and every child-model create site in this app first
// re-fetches the parent it's attaching to (the flight, the bottle)
// through this same scoped client to confirm it exists, which a foreign
// id already fails before the create is ever reached. Enforcing it again
// here would be guarding a door every real call site already closes.
const DIRECT_OWNER_MODELS = new Set(["Bottle", "TastingFlight", "SavedPairing"]);

const RELATION_OWNER_MODELS = {
  TastingNote: "bottle",
  BottlePhoto: "bottle",
  ResearchProposal: "bottle",
  FlightPick: "flight",
  PairingPick: "pairing",
};

// Operations whose `where` targets a single row by a unique key - id, or a
// unique compound like ResearchProposal's bottleId (upsert included: it
// looks a row up the same way before deciding whether to create or
// update). The scope filter joins the unique key as a sibling property
// rather than wrapping it in AND, because Prisma's WhereUniqueInput needs
// at least one genuinely unique field at the top level to resolve which
// row is meant - burying it inside AND would leave nothing there and
// fail. Combining a unique field with an extra non-unique or relation
// filter this way is stable Prisma behaviour ("extended where unique
// input"): a mismatch reads as "no such row" - null, or a P2025 on
// update/delete - never as an error naming why, which is exactly the
// vagueness an ownership check should have.
const SINGLE_ROW_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);

// Operations whose `where` is an ordinary filter, safe to AND-compose with
// whatever the caller already asked for.
const MULTI_ROW_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "updateMany",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

// The owner-scoped client. Every read, update, delete and upsert lookup on
// the eight models above is filtered to the signed-in owner before it
// reaches Postgres; every other model, and create/createMany on these,
// pass through unchanged. Use this everywhere in app/ and lib/ that reads
// or writes a person's own cellar data. lib/prisma.js's plain client
// stays for everything this file deliberately exempts, and for the one
// research-step path that has no session to scope by.
export const db = prisma.$extends({
  name: "ownerScoping",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const isDirect = DIRECT_OWNER_MODELS.has(model);
        const relation = RELATION_OWNER_MODELS[model];
        if (!isDirect && !relation) return query(args);

        const single = SINGLE_ROW_OPS.has(operation);
        if (!single && !MULTI_ROW_OPS.has(operation)) {
          // create, createMany, createManyAndReturn, and anything else not
          // explicitly listed above - see the comment at the top of this
          // file for why creates are exempt.
          return query(args);
        }

        const ownerId = await currentOwnerId();
        const scope = isDirect ? { ownerId } : { [relation]: { ownerId } };
        const where = single
          ? { ...(args?.where ?? {}), ...scope }
          : args?.where
            ? { AND: [args.where, scope] }
            : scope;

        return query({ ...args, where });
      },
    },
  },
});
