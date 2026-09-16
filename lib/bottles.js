import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
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
// it fetches one row per bottle rather than every note, so the exception
// costs a bounded query rather than the payload it was avoiding.
export async function getBottles(status, { withLatestNote = false } = {}) {
  const bottles = await prisma.bottle.findMany({
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

  // One row per bottle, newest first, selected server-side - not every note
  // filtered down in JS, which would pull the text this select exists to
  // leave behind. Keyed by bottle id for the map below.
  const latestNotes = new Map();
  if (withLatestNote && bottles.length > 0) {
    const rows = await prisma.tastingNote.findMany({
      where: { bottleId: { in: bottles.map((b) => b.id) } },
      orderBy: [{ bottleId: "asc" }, { tastedAt: "desc" }],
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
    // Free here - the ratings were already loaded - and says whether the one
    // note shown is the whole story or the most recent of several.
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
      // Absent rather than null when not asked for, so a list that never
      // requested notes can't quietly render an empty one.
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
export const getRegionOptions = unstable_cache(
  async () => {
    const rows = await prisma.bottle.findMany({
      where: { region: { not: null } },
      select: { region: true },
      distinct: ["region"],
    });
    const saved = rows.map((r) => r.region).filter(Boolean);
    return [...new Set([...KNOWN_REGIONS, ...saved])].sort((a, b) => a.localeCompare(b));
  },
  ["region-options"],
  { tags: [REGION_OPTIONS_TAG], revalidate: 3600 }
);
