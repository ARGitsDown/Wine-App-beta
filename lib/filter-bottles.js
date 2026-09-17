import { canonicalizeVarietal } from "@/lib/varietal-match";

// Strips accents so "chateau" matches "Château" and "cotes" matches
// "Côtes" (BACKLOG #27) - a real, common case for this data (French,
// Italian, Spanish and German producer and region names), fixed without a
// dependency: .normalize("NFD") decomposes a precomposed accented
// character into its base letter plus a separate combining mark, and the
// regex strips those marks (Unicode range U+0300-U+036F covers the
// combining diacriticals) off afterward. Applied to both sides of every
// comparison below, not just what's typed - a bottle logged with the
// accent still has to match a search typed without one, and vice versa.
// Deliberately not edit-distance/typo tolerance, which is a different,
// pricier fix (a short producer name can false-positive against an
// unrelated one at distance 1-2) - see BACKLOG #27 for why that's held for
// its own follow-up rather than bundled in here.
function fold(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Every field the free-text search box looks at, so "rochioli", "margaux"
// and "2018" all find something without the user having to know which
// filter box the term belongs in.
function searchableText(bottle) {
  return fold(
    [
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
      .toLowerCase()
  );
}

function includesInsensitive(value, term) {
  if (!value) return false;
  return fold(value.toLowerCase()).includes(fold(term.toLowerCase()));
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

// The keys that stay behind FilterBar's "More filters" disclosure - every
// filter except the free-text Search box, which is always visible now
// (BACKLOG #27) and so has nothing to seed the panel open for. Used only
// for that one seed - the panel's internal "Clear all" and the chip row
// still mean every filter, search included, and keep using hasAnyFilter.
const PANEL_FILTER_KEYS = FILTER_KEYS.filter((key) => key !== "search");

export function hasAnyPanelFilter(filters) {
  return PANEL_FILTER_KEYS.some((key) => filters[key]);
}

// How each filter reads on a chip. Most values say what they are on their
// own - "Burgundy", "Red" - so naming the field again would just be noise;
// the two that don't get a word in front.
const CHIP_LABEL = {
  search: (value) => `\u201c${value}\u201d`,
  variety: (value) => value,
  region: (value) => value,
  subRegion: (value) => value,
  country: (value) => value,
  wineColor: (value) => value,
  vintage: (value) => `Vintage ${value}`,
  rating: (value) => `${value}+ stars`,
};

// The filters currently narrowing the list, in panel order, as
// { key, label }. The collapsed panel used to say how many bottles were
// hidden without saying why, which left a short list looking like a small
// cellar rather than a filtered one.
export function activeFilterChips(filters) {
  return FILTER_KEYS.filter((key) => filters[key]).map((key) => ({
    key,
    label: CHIP_LABEL[key](filters[key]),
  }));
}

export const SORT_OPTIONS = [
  { value: "producer", label: "Producer A–Z" },
  { value: "drink", label: "Drink soon", needs: "drinkWindow" },
  { value: "recent", label: "Recently added" },
  { value: "emptied", label: "Recently emptied", needs: "emptied" },
  { value: "acquired", label: "Recently acquired", needs: "acquired" },
  { value: "vintage-desc", label: "Vintage, newest first" },
  { value: "vintage-asc", label: "Vintage, oldest first" },
  { value: "rating", label: "Highest rated", needs: "rating" },
];

// Sorts that only make sense somewhere they apply: a guest is never shown
// the owner's ratings, and a drinking window is meaningless for a bottle
// that's already been drunk.
export function sortOptionsFor({
  rating = true,
  drinkWindow = true,
  emptied = false,
  acquired = false,
} = {}) {
  return SORT_OPTIONS.filter(
    (option) =>
      !option.needs ||
      (option.needs === "rating" && rating) ||
      (option.needs === "drinkWindow" && drinkWindow) ||
      (option.needs === "emptied" && emptied) ||
      (option.needs === "acquired" && acquired)
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
    case "acquired":
      // Same nulls-last treatment as "emptied", and for the same reason:
      // a bottle logged before this column existed has no date and belongs
      // after the ones that do, not at the old end of the list.
      return sorted.sort(
        (a, b) =>
          nullsLast(
            a.acquiredAt && new Date(a.acquiredAt).getTime(),
            b.acquiredAt && new Date(b.acquiredAt).getTime(),
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
// Derived fields getBottles() attaches, none of which are columns: every
// bottle carries `canonicalVariety`, `averageRating` and `noteCount`, and a
// list that asked for them (only /consumed does) also carries `latestNote`.
// Kept here because this is where someone writing a new filter or sort looks
// to find out what a bottle object actually contains.
export function filterBottles(bottles, filters = {}) {
  const { search, variety, region, subRegion, country, wineColor, vintage, rating } = filters;

  // If the search term itself names one recognized grape (e.g. "Grenache"),
  // also match bottles logged under a regional synonym (e.g. "Garnacha") -
  // see BACKLOG.md #1. Falls back to the plain substring match below for
  // anything that doesn't resolve to a single known grape.
  const varietyCanonical = variety ? canonicalizeVarietal(variety) : null;
  const searchTerm = search?.trim().toLowerCase();
  const foldedSearchTerm = searchTerm ? fold(searchTerm) : null;

  return bottles.filter((bottle) => {
    if (foldedSearchTerm && !searchableText(bottle).includes(foldedSearchTerm)) return false;
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
