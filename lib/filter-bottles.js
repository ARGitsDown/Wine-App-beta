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

export const DEFAULT_SORT = "producer";

export const EMPTY_FILTERS = {
  search: "",
  variety: "",
  region: "",
  subRegion: "",
  country: "",
  wineColor: "",
  vintage: "",
  rating: "",
  sort: DEFAULT_SORT,
};

// Sort lives in the same state object as the filters (one thing to sync to
// the URL), but it is not itself a filter: it never hides a bottle, so it
// shouldn't light up "Clear" or force the panel open.
const FILTER_KEYS = Object.keys(EMPTY_FILTERS).filter((key) => key !== "sort");

export function hasAnyFilter(filters) {
  return FILTER_KEYS.some((key) => filters[key]);
}

export const SORT_OPTIONS = [
  { value: "producer", label: "Producer A–Z" },
  { value: "drink", label: "Drink soon", needs: "drinkWindow" },
  { value: "recent", label: "Recently added" },
  { value: "emptied", label: "Recently emptied", needs: "emptied" },
  { value: "vintage-desc", label: "Vintage, newest first" },
  { value: "vintage-asc", label: "Vintage, oldest first" },
  { value: "rating", label: "Highest rated", needs: "rating" },
];

// Sorts that only make sense somewhere they apply: a guest is never shown
// the owner's ratings, and a drinking window is meaningless for a bottle
// that's already been drunk.
export function sortOptionsFor({ rating = true, drinkWindow = true, emptied = false } = {}) {
  return SORT_OPTIONS.filter(
    (option) =>
      !option.needs ||
      (option.needs === "rating" && rating) ||
      (option.needs === "drinkWindow" && drinkWindow) ||
      (option.needs === "emptied" && emptied)
  );
}

function byProducer(a, b) {
  return (a.producer || "").localeCompare(b.producer || "");
}

// Sorts a missing value to the end regardless of direction - an NV
// champagne or an unrated bottle belongs after everything that has the
// value, not clumped at whichever end happens to be numerically extreme.
function nullsLast(aValue, bValue, compare) {
  if (aValue == null && bValue == null) return 0;
  if (aValue == null) return 1;
  if (bValue == null) return -1;
  return compare(aValue, bValue);
}

// How close a bottle is to needing drinking, most urgent first: past its
// window, then inside it, then not ready yet, then no window on file at
// all. Within a group, the one whose window closes soonest leads - which
// is what makes "ending soon" fall out without needing its own bucket.
function drinkUrgency(bottle, currentYear) {
  if (bottle.drinkTo == null && bottle.drinkFrom == null) return 3;
  if (bottle.drinkTo != null && currentYear > bottle.drinkTo) return 0;
  if (bottle.drinkFrom != null && currentYear < bottle.drinkFrom) return 2;
  return 1;
}

export function sortBottles(bottles, sort = DEFAULT_SORT) {
  const currentYear = new Date().getFullYear();
  // The caller's array is the server's; copy before ordering it.
  const sorted = [...bottles];

  switch (sort) {
    case "drink":
      return sorted.sort(
        (a, b) =>
          drinkUrgency(a, currentYear) - drinkUrgency(b, currentYear) ||
          nullsLast(a.drinkTo, b.drinkTo, (x, y) => x - y) ||
          byProducer(a, b)
      );
    case "emptied":
      // Rows that reached History before emptiedAt existed have no date;
      // they sort last rather than pretending to be the oldest.
      return sorted.sort(
        (a, b) =>
          nullsLast(
            a.emptiedAt && new Date(a.emptiedAt).getTime(),
            b.emptiedAt && new Date(b.emptiedAt).getTime(),
            (x, y) => y - x
          ) || byProducer(a, b)
      );
    case "recent":
      return sorted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          byProducer(a, b)
      );
    case "vintage-desc":
      return sorted.sort(
        (a, b) => nullsLast(a.vintage, b.vintage, (x, y) => y - x) || byProducer(a, b)
      );
    case "vintage-asc":
      return sorted.sort(
        (a, b) => nullsLast(a.vintage, b.vintage, (x, y) => x - y) || byProducer(a, b)
      );
    case "rating":
      return sorted.sort(
        (a, b) =>
          nullsLast(a.averageRating, b.averageRating, (x, y) => y - x) || byProducer(a, b)
      );
    default:
      return sorted.sort(byProducer);
  }
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
