import { prisma } from "@/lib/prisma";
import { canonicalizeVarietal } from "@/lib/varietal-match";

// Wine collections are small (dozens to a few hundred bottles for a personal
// cellar), so it's simpler and fast enough to load everything for a status
// and filter it here in JavaScript, rather than build up conditional SQL.
export async function getBottles(status, filters = {}) {
  const bottles = await prisma.bottle.findMany({
    where: { status },
    include: { tastingNotes: true, favorites: { include: { guest: true } } },
    orderBy: { producer: "asc" },
  });

  const withRating = bottles.map((bottle) => {
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
    // Recomputed live rather than trusting the stored column, so a bottle
    // saved before canonicalVariety existed (or before its grape was added
    // to lib/varietals.js) still matches correctly - no backfill migration
    // needed for existing data.
    const canonicalVariety = canonicalizeVarietal(bottle.type, bottle.variety);
    return { ...bottle, averageRating, favoritedBy, canonicalVariety };
  });

  const { variety, region, country, vintage, rating } = filters;
  // If the search term itself names one recognized grape (e.g. "Grenache"),
  // also match bottles logged under a regional synonym (e.g. "Garnacha") -
  // see BACKLOG.md #1. Falls back to the plain substring match below for
  // anything that doesn't resolve to a single known grape.
  const varietyCanonical = variety ? canonicalizeVarietal(variety) : null;

  return withRating.filter((bottle) => {
    if (variety) {
      const matchesRaw = bottle.variety?.toLowerCase().includes(variety.toLowerCase());
      const matchesCanonical =
        varietyCanonical && bottle.canonicalVariety === varietyCanonical;
      if (!matchesRaw && !matchesCanonical) return false;
    }
    if (
      region &&
      !bottle.region?.toLowerCase().includes(region.toLowerCase())
    ) {
      return false;
    }
    if (
      country &&
      !bottle.country?.toLowerCase().includes(country.toLowerCase())
    ) {
      return false;
    }
    if (vintage && bottle.vintage !== Number(vintage)) {
      return false;
    }
    if (
      rating &&
      (bottle.averageRating === null || bottle.averageRating < Number(rating))
    ) {
      return false;
    }
    return true;
  });
}
