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
// `short` is the one-word form used on the picker cards. It names the
// activity ("Tasting") rather than the resulting status ("Tasted", which is
// what the per-card control says once a wine is saved) - the cards are
// chosen before the photos, when it hasn't happened yet.
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
    short: "Tasting",
    label: "Tasting now",
    hint: "Drinking these today — recorded as tasted",
  },
];

// Where a saved bottle actually lives, by its status. The scan flow needs
// this in the browser - to label each card's status control, and to link
// somewhere once a batch finishes - and the server's own pathForStatus is
// private to app/actions.js, so the three places share one list here
// rather than each spelling out its own.
export const BOTTLE_DESTINATIONS = [
  { status: "inventory", label: "Cellar", path: "/inventory" },
  { status: "wishlist", label: "Wishlist", path: "/wishlist" },
  // "Tasted" rather than "Tasting notes": this labels what happened to the
  // bottle, not the page it lands on.
  { status: "consumed", label: "Tasted", path: "/consumed" },
];

// Same fallback reasoning as statusForScanIntent below.
export function destinationForStatus(status) {
  return BOTTLE_DESTINATIONS.find((d) => d.status === status) ?? BOTTLE_DESTINATIONS[0];
}

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
