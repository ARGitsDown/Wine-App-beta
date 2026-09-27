import "server-only";
import { prisma } from "@/lib/prisma";
import { currentCellarmaster } from "@/lib/owner";

// Phase 2 of separate cellars per user (FUTURE_CAPABILITIES.md): the
// backbone the whole plan was built around - and, since Phase 1 of Shared
// cellars, scoped by Domaine rather than by person: every member of one
// Domaine shares one cellar, so the filter is "this Domaine's rows", and
// which member asked only matters for attribution (ownerId, set at each
// create site) and for whether they may ask at all (role, below). Roughly a hundred call sites
// across this app ask Prisma for a bottle, a flight, a pairing, or
// something that hangs off one of those - and every one of them was,
// until now, a place a mistake could leak one person's cellar into
// another's view. Fixing that call site by call site would mean getting
// it right about a hundred times in a row. This fixes it once, here, by
// injecting the owner filter into the query itself before it ever reaches
// Postgres.
//
// Two shapes of ownership in this schema (see prisma/schema.prisma):
//   - Direct: Bottle, TastingFlight and SavedPairing carry domaineId
//     themselves.
//   - Inherited: TastingNote, BottlePhoto and ResearchProposal belong to
//     whichever Domaine owns their bottle; FlightPick to its flight's;
//     PairingPick to its pairing's. None of these has a domaineId column
//     of its own, so the filter has to reach through the
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
//     all - see resolveGuestView in lib/guest.js and the (guest) route
//     group for how that page scopes itself instead.
//   - ResearchJob has its own domaineId column but is deliberately NOT
//     scoped here: the step that reads it (app/api/research/step/route.js)
//     runs from a plain HTTP route hit by a server-to-server fetch with no
//     session attached, so it filters explicitly using the job's own
//     domaineId rather than through this session-reading client. See that
//     route and researchStep in app/actions.js.
//
// Creates on the three roots get their domaineId stamped here rather than
// at each call site: a bottle always belongs to the Domaine of whoever is
// adding it, so there's no decision for a call site to make, only a
// chance to forget it. A create that names a different Domaine is
// refused rather than silently overwritten - no call site does that, so
// one appearing would be a bug worth hearing about. Child-model creates
// (a tasting note, a flight pick) have no column to stamp: every such
// create site in this app first re-fetches the parent it's attaching to
// (the flight, the bottle) through this same scoped client to confirm it
// exists, which a foreign id already fails before the create is reached.
//
// Every operation on these models - reads included - also requires a
// Cellarmaster (currentCellarmaster in lib/owner.js). A guest-role member
// browses through /guest's own plain-client view, never through this
// client, so there is no legitimate guest call to let through, and
// refusing reads too means an owner-side Server Action that reads the
// cellar before calling Claude fails before the spend rather than after.
// The two that call Claude first (scan and Suggest) check for themselves.
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

// Operations that insert rows, and where their data lives in args.
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

// Stamps the member's Domaine onto one root-model row being created, and
// refuses one already naming another.
function stampDomaine(data, domaineId) {
  if (data?.domaineId !== undefined && data.domaineId !== domaineId) {
    throw new Error("Refusing to create a row in another Domaine's cellar.");
  }
  return { ...data, domaineId };
}

// The Domaine-scoped client. Every read, update, delete and upsert lookup
// on the eight models above is filtered to the signed-in member's Domaine
// before it reaches Postgres, and every root-model create is stamped with
// it; every other model passes through unchanged. Use this everywhere in app/ and lib/ that reads
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

        // Before anything else, reads included - see the top of this file.
        const { domaineId } = await currentCellarmaster();

        if (CREATE_OPS.has(operation)) {
          if (!isDirect) return query(args);
          const data = Array.isArray(args.data)
            ? args.data.map((row) => stampDomaine(row, domaineId))
            : stampDomaine(args.data, domaineId);
          return query({ ...args, data });
        }

        const single = SINGLE_ROW_OPS.has(operation);
        if (!single && !MULTI_ROW_OPS.has(operation)) {
          // Nothing else is used on these models today. Refused rather
          // than passed through unscoped, so a new kind of call fails
          // loudly the first time instead of quietly reaching across
          // Domaines.
          throw new Error(`${model}.${operation} isn't scoped by lib/scoped-prisma.js yet.`);
        }

        const scope = isDirect ? { domaineId } : { [relation]: { domaineId } };
        // An upsert that ends up creating needs the same stamp a plain
        // create gets.
        if (operation === "upsert" && isDirect) {
          args = { ...args, create: stampDomaine(args.create, domaineId) };
        }
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
