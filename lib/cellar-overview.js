// The shape of a cellar, in numbers, from the bottles already in the browser.
// Pure, so the arithmetic is tested (scripts/overview.test.mjs) and the page
// that shows it has nothing to get wrong.
//
// A row is a lot of `quantity` bottles (see the Bottle comment in
// prisma/schema.prisma), so "wines" counts rows and "bottles" sums quantity.
// Every group below is a list of { key, count } where `key` is exactly the
// value the matching filter takes, so a tap on a count is a filter, not a
// guess at one.

import { windowBucket } from "./drink-window.js";
import { litres } from "./bottle-sizes.js";

function tally(values) {
  const counts = new Map();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function summarizeCellar(bottles, currentYear = new Date().getFullYear(), { topRegions = 6 } = {}) {
  const window = { ready: 0, past: 0, later: 0, none: 0 };
  let readyEstimated = 0;
  let bottleCount = 0;
  let totalLitres = 0;
  for (const bottle of bottles) {
    const bucket = windowBucket(bottle, currentYear);
    window[bucket] += 1;
    if (bucket === "ready" && bottle.drinkWindowEstimated) readyEstimated += 1;
    bottleCount += bottle.quantity ?? 1;
    totalLitres += litres(bottle.quantity ?? 1, bottle.sizeMl);
  }
  return {
    wines: bottles.length,
    bottles: bottleCount,
    litres: Math.round(totalLitres * 100) / 100,
    window,
    readyEstimated,
    colors: tally(bottles.map((b) => b.wineColor)),
    regions: tally(bottles.map((b) => b.region)).slice(0, topRegions),
    locations: tally(bottles.map((b) => b.location)),
    unplaced: bottles.filter((b) => !b.location).length,
  };
}

// "8 ready now" for a card or a summary line; null when nothing is, so the
// caller says something else (or nothing) instead of "0 ready now".
export function readyNowText(readyCount, estimated = 0) {
  if (readyCount <= 0) return null;
  return estimated > 0 ? `${readyCount} ready now \u00b7 ${estimated} est.` : `${readyCount} ready now`;
}
