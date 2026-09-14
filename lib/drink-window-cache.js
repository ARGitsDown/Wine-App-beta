// The identity of a wine for drinking-window purposes: two bottles with the
// same answer to "when is this at its best?" should share one estimate.
//
// Producer, bottling and vintage carry nearly all of that - a producer's
// estate bottling and their single-vineyard one age differently, and a 2015
// and a 2016 of the same wine are different questions. Grape and region are
// included as much to keep genuinely different wines apart (two producers
// can share a name) as to inform the answer.
//
// Deliberately NOT part of the key: subRegion, country, abv, wineColor.
// They're either implied by region or irrelevant to ageing, and every extra
// field is another way for two spellings of the same wine to miss each
// other and pay for the same question twice.
function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function drinkWindowCacheKey(bottle) {
  return [
    normalize(bottle.producer),
    normalize(bottle.bottling),
    // Falls back to the printed variety so a bottle whose grape didn't
    // resolve to the canonical list still keys consistently with itself.
    normalize(bottle.canonicalVariety || bottle.type || bottle.variety),
    normalize(bottle.region),
    normalize(bottle.vintage),
  ].join("|");
}
