// The bottle fields a research pass can propose, with the labels the review
// UI shows them under.
//
// `RESEARCH_TOOL` in app/actions.js is the source of truth for what the
// model is asked to return; this is the same list as plain data, so the
// stored proposal and the diff that renders it can't drift apart silently.
// Adding a field to the tool schema means adding it here too - otherwise it
// is saved in the proposal and never shown to anyone.
export const RESEARCH_FIELDS = [
  { key: "bottling", label: "Bottling / vineyard" },
  { key: "vintage", label: "Vintage" },
  { key: "type", label: "Type" },
  { key: "variety", label: "Variety" },
  { key: "region", label: "Region" },
  { key: "subRegion", label: "Sub-region" },
  { key: "country", label: "Country" },
  { key: "abv", label: "ABV %" },
  { key: "wineColor", label: "Color" },
  { key: "drinkFrom", label: "Drink from" },
  { key: "drinkTo", label: "Drink to" },
  { key: "criticNotes", label: "Critic & winemaker notes" },
];

// Null, undefined and "" all mean "nothing on file" and must not read as a
// change from one another. Numbers are compared as numbers so 14.5 doesn't
// differ from "14.5" purely because one came back through JSON.
function normalize(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  const text = String(value).trim();
  return text;
}

function same(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (typeof left === "number" || typeof right === "number") {
    return Number(left) === Number(right);
  }
  return left === right;
}

// What this proposal would actually change, field by field. Everything the
// model repeated back unchanged is dropped - the point of the review is to
// show what moved, which the old prefilled-form flow never did.
//
// `key in proposed`, not just `proposed[key]` being present - a field
// missing from the object entirely means the proposal has no opinion on it
// (the schema's own `strict: true` plus every RESEARCH_FIELDS key being
// `required` in RESEARCH_TOOL means this shouldn't happen today), and has
// to read as "unchanged", not as "propose blanking it out". Before this, a
// bottle's whole record would render as being erased - and applyResearchProposal
// would actually write nulls over real data - the one time a proposal came
// back partial (a visual UX review, 2026-09-27, surfaced this by actually
// rendering a proposal seeded with only 3 of 12 fields).
export function researchChanges(bottle, proposed) {
  if (!proposed) return [];
  return RESEARCH_FIELDS.filter(
    ({ key }) => key in proposed && !same(bottle[key], proposed[key])
  ).map(({ key, label }) => ({
    key,
    label,
    from: bottle[key],
    to: proposed[key],
  }));
}

// A proposal computed against values the bottle no longer has. Flagged
// rather than thrown away: the review shows current beside proposed, so you
// can see what moved underneath it and decide. Compared with a second of
// slack, since updatedAt is touched by the same write that creates the
// proposal's sibling rows in some flows.
export function isProposalStale(bottle, proposal) {
  if (!proposal) return false;
  return new Date(bottle.updatedAt).getTime() > new Date(proposal.createdAt).getTime() + 1000;
}

// The research tool's own instructions say that a drinking window which
// was read from a source or typed by the owner (i.e. is *not* marked as
// the app's estimate) must be repeated back unchanged - overwriting
// someone's own judgment "is not research". That rule was enforced by the
// prompt alone, and a lighter model without thinking (what a Domaine falls
// back to over its monthly cap) is the likeliest to ignore it; one-click
// accept then applies the whole proposal. So the rule is made true here,
// where the proposal is filed, whatever the model answered (BACKLOG #55).
// An estimated window, or none at all, is exactly what research is
// allowed to improve, and is left alone.
export function holdOwnersWindow(proposed, bottle) {
  const hasWindow = bottle.drinkFrom != null || bottle.drinkTo != null;
  if (!hasWindow || bottle.drinkWindowEstimated) return proposed;
  return {
    ...proposed,
    drinkFrom: bottle.drinkFrom,
    drinkTo: bottle.drinkTo,
    drinkWindowEstimated: false,
  };
}
