// Every kind of Claude call this app makes, by the name the usage ledger
// files it under - UsageEvent.feature in prisma/schema.prisma. One list,
// imported by the call sites (app/actions.js), the ledger writer
// (lib/usage.js) and the notice that depends on which features are held
// (AiLimitNotice), instead of a string repeated in each. A call site with a
// misspelt name used to write a ledger row nothing would ever group with
// the others, with no error anywhere.
//
// Plain data with no imports, safe from any component or script.
export const FEATURE = Object.freeze({
  SCAN: "scan",
  SUGGEST: "suggest",
  RESEARCH: "research",
  ESTIMATE_WINDOWS: "estimate-windows", // both the bulk run and the single-bottle button
  PHOTO_DETAILS: "photo-details",
});
export const FEATURE_VALUES = new Set(Object.values(FEATURE));

// The features that stay on their normal model when a Domaine is over its
// monthly cap, and are only ever stopped, at the hard stop. These are the
// ones whose answers are saved without anyone reviewing them: Scan writes
// bottles straight into the cellar, and the drinking-window estimators
// write straight onto bottles *and* into a cache that answers every Domaine
// for ever. A cheaper, unmeasured model getting those wrong costs more in
// bad data than it saves in money. Everything else that spends - Suggest's
// picks, Research's proposals, a photo's proposed details - is looked at by
// a person first, and goes a tier down.
//
// The one list behind both the gate (ai.call in lib/usage.js) and the
// screens that say "running on lighter models" (AiLimitNotice), so a
// feature cannot be held in one and described as lighter in the other.
export const HELD_FEATURES = new Set([FEATURE.SCAN, FEATURE.ESTIMATE_WINDOWS]);
