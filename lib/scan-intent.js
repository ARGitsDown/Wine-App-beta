// What a scanning session is for, chosen once before the photos rather than
// guessed per wine.
//
// Scan used to infer this: a wine whose source document carried
// tasting-note text went to Tasting notes, everything else to the cellar. That
// conflated two different things - a shop's tasting sheet *describes* a
// wine, it doesn't say you drank it - and the guess was never explained,
// so correcting it meant noticing a wrong status on each card afterward.
//
// The intent sets the default for every wine in the batch; each card's own
// status control still overrides it, so a mixed batch stays possible.
//
// `short` is the one-word destination as it appears on the picker cards, and
// deliberately matches the labels on that per-card control - naming the same
// three places two different ways on one screen is worse than either name.
// `label`/`hint` are the fuller phrasings, kept for anywhere with room.
export const SCAN_INTENTS = [
  {
    value: "cellar",
    status: "inventory",
    short: "Cellar",
    label: "Adding to the cellar",
    hint: "Bottles you now own",
  },
  {
    value: "wishlist",
    status: "wishlist",
    short: "Wishlist",
    label: "Noting for later",
    hint: "A shop shelf or a list to remember",
  },
  {
    value: "tasting",
    status: "consumed",
    short: "Tasted",
    label: "Tasting now",
    hint: "Drinking these today — recorded as tasted",
  },
];

export const DEFAULT_SCAN_INTENT = "cellar";

// Anything unrecognised falls back to the cellar: it's the common case, and
// the least annoying of the three to have to correct.
export function statusForScanIntent(intent) {
  return SCAN_INTENTS.find((i) => i.value === intent)?.status ?? "inventory";
}

// For the ?intent= param, which is whatever the URL says it is. Same
// fallback as above, so a typo or a stale link starts on the cellar rather
// than on an empty or invented selection.
export function normalizeScanIntent(value) {
  return SCAN_INTENTS.some((i) => i.value === value) ? value : DEFAULT_SCAN_INTENT;
}
