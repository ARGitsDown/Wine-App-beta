// Where a wine is from, and what it's made of, as one line.
//
// This exists because there were four versions of it. The scan card wrote
// `(variety || type) · region · subRegion · country`, the cellar's expanded
// panel wrote `variety · region · subRegion · country`, the guest list wrote
// `variety · region · country` - dropping the sub-region - and the cellar's
// collapsed row wrote nothing at all, which is what BACKLOG #22 was raised
// about. Four places describing the same bottle four ways is a drift, not a
// design, and the only way it stays fixed is if there is one definition.

// Narrowest information last, the way a label reads: "Bordeaux · Margaux ·
// France". Sub-region is in here rather than left to the detail view
// because it is often the only thing that distinguishes two of a region's
// wines, and whether it is set at all depends on how the bottle happened
// to be entered - "Margaux" as the region, or Bordeaux plus Margaux as the
// sub-region. Including it means those two look the same on screen.
export function wineOrigin(bottle) {
  return [bottle.region, bottle.subRegion, bottle.country]
    .filter(Boolean)
    .join(" · ");
}

// The same, with the grape in front. `type` is the fallback because it is
// the short style/grape label and is often set when `variety` - the fuller
// one - isn't: a line that starts at the region when the grape is known is
// worse than one that names the grape twice.
export function wineDetail(bottle) {
  return [bottle.variety || bottle.type, bottle.region, bottle.subRegion, bottle.country]
    .filter(Boolean)
    .join(" · ");
}

// What the cellar's expanded panel shows. The row's title already names
// the producer, the vintage and the type, so a "detail" line that says
// only the type again is not detail - it is the same word twice, and the
// honest thing to say is that nothing more was recorded. The threshold is
// therefore variety or origin, not whether wineDetail() came back empty.
export function wineDetailOrNone(bottle) {
  if (!bottle.variety && !wineOrigin(bottle)) return "No variety/region set";
  return wineDetail(bottle);
}
