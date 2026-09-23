import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/scoped-prisma";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { KNOWN_REGIONS } from "@/lib/regions";

// Wine collections are small (dozens to a few hundred bottles for a personal
// cellar), so it's simpler and fast enough to load everything for a status
// and hand the whole set to the browser, which filters it instantly as you
// type - see lib/filter-bottles.js. That's why this takes no filter
// argument: narrowing the list is no longer a server round-trip.
//
// `withLatestNote` is a deliberate, named exception to the trimmed select
// below, for the one page that exists to show notes: /consumed is titled
// "Tasting notes" and promises them in its own subtitle, while rendering a
// list that had no note text in it at all. It is opt-in rather than a wider
// select because the reason the text is trimmed everywhere else still
// holds - the Cellar renders hundreds of rows and never shows a note - and
// what it protects is the browser payload: only one note per bottle is ever
// serialized, and no other list carries note text at all.
//
// Be precise about what the query does, because it is easy to misread.
// Prisma applies `distinct` in the client, not as a Postgres DISTINCT ON -
// the database returns every note for these bottles, text included, and the
// client keeps the first per bottle, which the ordering below makes the
// newest. Verified by reading the SQL Postgres actually received. That is
// fine at this size, and the bound that matters still holds. Two traps if
// this is ever changed: `take` would be applied by the database *before*
// the in-memory distinct and quietly return too few bottles, and a real
// one-row-per-bottle query needs $queryRaw with DISTINCT ON.
export async function getBottles(status, { withLatestNote = false } = {}) {
  const bottles = await db.bottle.findMany({
    where: { status },
    include: {
      // Only the score matters here (for the average below); pulling every
      // note's full text for every row is a lot of payload a list never
      // renders. The bottle's own page loads the notes themselves.
      tastingNotes: { select: { rating: true } },
      favorites: { select: { guest: { select: { name: true } } } },
    },
    orderBy: { producer: "asc" },
  });

  // One note per bottle, newest first - see the note on `distinct` above for
  // where that actually happens. Keyed by bottle id for the map below.
  const latestNotes = new Map();
  if (withLatestNote && bottles.length > 0) {
    const rows = await db.tastingNote.findMany({
      where: { bottleId: { in: bottles.map((b) => b.id) } },
      // The third key is load-bearing: tastedAt is a date-only value
      // anchored at noon UTC (lib/tasting-date.js), so two notes on the
      // same day are exactly equal, not nearly. Without it the winner is
      // whatever order Postgres' sort happened to produce, and can differ
      // from the bottle's own page - which settles the same tie with
      // `id: desc` (app/(owner)/bottles/[id]/page.js).
      orderBy: [{ bottleId: "asc" }, { tastedAt: "desc" }, { id: "desc" }],
      distinct: ["bottleId"],
      select: { bottleId: true, note: true, tastedAt: true },
    });
    for (const row of rows) {
      latestNotes.set(row.bottleId, { note: row.note, tastedAt: row.tastedAt });
    }
  }

  return bottles.map((bottle) => {
    // Ratings are optional (a tasting note can be logged without a
    // personal score), so exclude the unrated ones rather than let them
    // count as zero and drag the average down.
    const ratings = bottle.tastingNotes
      .map((t) => t.rating)
      .filter((r) => r !== null);
    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;
    const favoritedBy = bottle.favorites.map((f) => f.guest.name);
    // Trust the stored column when it's set (the normal case); only
    // recompute live for a bottle saved before canonicalVariety existed (or
    // before its grape was added to lib/varietals.js), so old rows still
    // match correctly without a backfill migration.
    const canonicalVariety = bottle.canonicalVariety ?? canonicalizeVarietal(bottle.type, bottle.variety);
    // Returned unconditionally, unlike latestNote: the count is free from
    // rows already loaded, the text is not. Says whether the one note shown
    // is the whole story or the most recent of several.
    const noteCount = bottle.tastingNotes.length;
    // tastingNotes/favorites were only needed to derive the fields above,
    // and shipping them to the client as well would undo the trimmed
    // select.
    const { tastingNotes, favorites, ...rest } = bottle;
    return {
      ...rest,
      averageRating,
      favoritedBy,
      canonicalVariety,
      noteCount,
      // Only present when asked for. The guard that matters is upstream, not
      // here: a list that didn't ask never has note text serialized to it at
      // all - the consumer just checks truthiness, so absent and null read
      // the same to it. `null` means "asked, and this bottle has none",
      // which noteCount === 0 also says.
      ...(withLatestNote ? { latestNote: latestNotes.get(bottle.id) ?? null } : {}),
    };
  });
}

// Invalidated whenever a bottle is written, since that's the only way a new
// region name can appear - see invalidateRegionOptions in app/actions.js.
export const REGION_OPTIONS_TAG = "region-options";

// The curated region list plus every distinct region already saved (across
// all three statuses) - so the autocomplete suggests a region you've typed
// before even if it's not on the curated list, without needing you to
// retype it exactly the same way again.
//
// Cached because this ran on every list page and every bottle page, as a
// distinct-over-the-whole-table scan, for a result that only changes when
// someone uses a region name for the first time. The hourly revalidate is
// a backstop; the tag above is what actually keeps it current.
//
// Takes ownerId explicitly rather than reading a session itself, because
// `unstable_cache` caches across requests and across *everyone* - unlike
// lib/scoped-prisma.js's extension, which only ever protects one request.
// A single cache key would mean whichever owner asks first gets their own
// region list cached and served back to every other owner afterward. Next
// folds a wrapped function's own arguments into its cache key, so passing
// ownerId here is what actually gives each owner their own cache entry
// rather than sharing one. The plain client is used inside deliberately
// (not lib/scoped-prisma.js's db), since this also has to serve /guest,
// which has no session for that client to read - see guestOwnerId in
// lib/owner.js for what it passes instead.
const getRegionOptionsForOwner = unstable_cache(
  async (ownerId) => {
    const rows = await prisma.bottle.findMany({
      where: { region: { not: null }, ownerId },
      select: { region: true },
      distinct: ["region"],
    });
    const saved = rows.map((r) => r.region).filter(Boolean);
    return [...new Set([...KNOWN_REGIONS, ...saved])].sort((a, b) => a.localeCompare(b));
  },
  ["region-options"],
  { tags: [REGION_OPTIONS_TAG], revalidate: 3600 }
);

export async function getRegionOptions(ownerId) {
  return getRegionOptionsForOwner(ownerId);
}

// How many bottles are waiting on research: flagged during a scan, or
// already carrying a proposal nobody has reviewed. Two different sets, and
// the badge has to count both - researching a bottle from its own page
// leaves a proposal waiting with no flag on it.
//
// React's `cache`, not `unstable_cache` above: the count must be current on
// every request, and what is being avoided is asking Postgres the same
// question twice in one render. The owner layout asks once for the nav link
// and once for the tab bar's dot, which are the same question in two places
// on the same screen.
export const getResearchCount = cache(() =>
  db.bottle.count({
    where: {
      OR: [{ needsResearch: true }, { researchProposal: { isNot: null } }],
    },
  })
);
