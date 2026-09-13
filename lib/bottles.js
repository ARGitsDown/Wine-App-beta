import { prisma } from "@/lib/prisma";

// Wine collections are small (dozens to a few hundred bottles for a personal
// cellar), so it's simpler and fast enough to load everything for a status
// and filter it here in JavaScript, rather than build up conditional SQL.
export async function getBottles(status, filters = {}) {
  const bottles = await prisma.bottle.findMany({
    where: { status },
    include: { tastingNotes: true },
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
    return { ...bottle, averageRating };
  });

  const { variety, region, country, vintage, rating } = filters;

  return withRating.filter((bottle) => {
    if (
      variety &&
      !bottle.variety?.toLowerCase().includes(variety.toLowerCase())
    ) {
      return false;
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
