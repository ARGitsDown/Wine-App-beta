import { prisma } from "@/lib/prisma";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { KNOWN_REGIONS } from "@/lib/regions";

// Wine collections are small (dozens to a few hundred bottles for a personal
// cellar), so it's simpler and fast enough to load everything for a status
// and hand the whole set to the browser, which filters it instantly as you
// type - see lib/filter-bottles.js. That's why this takes no filter
// argument: narrowing the list is no longer a server round-trip.
export async function getBottles(status) {
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
    // tastingNotes/favorites were only needed to derive the two fields
    // above, and shipping them to the client as well would undo the
    // trimmed select.
    const { tastingNotes, favorites, ...rest } = bottle;
    return { ...rest, averageRating, favoritedBy, canonicalVariety };
  });
}

// The curated region list plus every distinct region already saved (across
// all three statuses) - so the autocomplete suggests a region you've typed
// before even if it's not on the curated list, without needing you to
// retype it exactly the same way again.
export async function getRegionOptions() {
  const rows = await prisma.bottle.findMany({
    where: { region: { not: null } },
    select: { region: true },
    distinct: ["region"],
  });
  const saved = rows.map((r) => r.region).filter(Boolean);
  return [...new Set([...KNOWN_REGIONS, ...saved])].sort((a, b) => a.localeCompare(b));
}
