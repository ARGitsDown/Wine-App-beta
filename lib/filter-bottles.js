import { canonicalizeVarietal } from "@/lib/varietal-match";

// Every field the free-text search box looks at, so "rochioli", "margaux"
// and "2018" all find something without the user having to know which
// filter box the term belongs in.
function searchableText(bottle) {
  return [
    bottle.producer,
    bottle.bottling,
    bottle.type,
    bottle.variety,
    bottle.region,
    bottle.subRegion,
    bottle.country,
    bottle.vintage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesInsensitive(value, term) {
  return Boolean(value?.toLowerCase().includes(term.toLowerCase()));
}

export const EMPTY_FILTERS = {
  search: "",
  variety: "",
  region: "",
  subRegion: "",
  country: "",
  wineColor: "",
  vintage: "",
  rating: "",
};

export function hasAnyFilter(filters) {
  return Object.keys(EMPTY_FILTERS).some((key) => filters[key]);
}

// Pure and dependency-free (no Prisma, no server-only imports) so the exact
// same matching runs in the browser for instant filtering and on the server
// for a bookmarked/shared URL - one definition rather than two that can
// drift apart.
//
// Bottles are expected to carry `canonicalVariety` and `averageRating`
// already, as getBottles() attaches them.
export function filterBottles(bottles, filters = {}) {
  const { search, variety, region, subRegion, country, wineColor, vintage, rating } = filters;

  // If the search term itself names one recognized grape (e.g. "Grenache"),
  // also match bottles logged under a regional synonym (e.g. "Garnacha") -
  // see BACKLOG.md #1. Falls back to the plain substring match below for
  // anything that doesn't resolve to a single known grape.
  const varietyCanonical = variety ? canonicalizeVarietal(variety) : null;
  const searchTerm = search?.trim().toLowerCase();

  return bottles.filter((bottle) => {
    if (searchTerm && !searchableText(bottle).includes(searchTerm)) return false;
    if (variety) {
      const matchesRaw = includesInsensitive(bottle.variety, variety);
      const matchesCanonical =
        varietyCanonical && bottle.canonicalVariety === varietyCanonical;
      if (!matchesRaw && !matchesCanonical) return false;
    }
    if (region && !includesInsensitive(bottle.region, region)) return false;
    if (subRegion && !includesInsensitive(bottle.subRegion, subRegion)) return false;
    if (country && !includesInsensitive(bottle.country, country)) return false;
    if (wineColor && bottle.wineColor !== wineColor) return false;
    if (vintage && bottle.vintage !== Number(vintage)) return false;
    if (
      rating &&
      (bottle.averageRating == null || bottle.averageRating < Number(rating))
    ) {
      return false;
    }
    return true;
  });
}
