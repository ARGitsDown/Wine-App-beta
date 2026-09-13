import { prisma } from "@/lib/prisma";

// Wine collections are small (dozens to a few hundred bottles for a personal
// cellar), so it's simpler and fast enough to load everything for a status
// and filter it here in JavaScript, rather than build up conditional SQL.
// This also sidesteps SQLite's case-sensitive text matching in Prisma.
export async function getBottles(status, filters = {}) {
  const bottles = await prisma.bottle.findMany({
    where: { status },
    include: { tastingNotes: true },
    orderBy: { producer: "asc" },
  });

  const withRating = bottles.map((bottle) => {
    const ratings = bottle.tastingNotes.map((t) => t.rating);
    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;
    return { ...bottle, averageRating };
  });

  const { variety, region, vintage, rating } = filters;

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
