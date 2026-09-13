import { VARIETALS } from "@/lib/varietals";

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Every (canonical, alias) pair, longest alias first. Checking longer
// aliases first - and remembering which part of the text they matched -
// means a short alias that's actually just a prefix of a longer one right
// there in the text (e.g. "Grenache" inside "Grenache Blanc") doesn't also
// match and create a false ambiguity between two different grapes.
const ALIAS_PAIRS = VARIETALS.flatMap((entry) =>
  entry.aliases.map((alias) => ({ canonical: entry.canonical, alias }))
).sort((a, b) => b.alias.length - a.alias.length);

// Best-effort match of a single canonical grape variety from freeform text
// (the bottle's `type` and/or `variety` fields, checked in that order).
// Deliberately conservative: if a text plausibly names more than one grape
// (a blend, or two candidate matches), this returns null rather than
// guessing which one "counts" - a blend is exactly the case the BACKLOG.md
// canonical-variety idea wasn't meant to solve.
export function canonicalizeVarietal(...texts) {
  for (const text of texts) {
    if (!text) continue;
    const cleaned = text.replace(/^likely\s+/i, "");

    const matches = new Set();
    const claimedRanges = [];
    for (const { canonical, alias } of ALIAS_PAIRS) {
      const pattern = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi");
      let match;
      while ((match = pattern.exec(cleaned))) {
        const start = match.index;
        const end = start + match[0].length;
        const overlapsClaimed = claimedRanges.some((r) => start < r.end && end > r.start);
        if (!overlapsClaimed) {
          matches.add(canonical);
          claimedRanges.push({ start, end });
        }
      }
    }

    if (matches.size === 1) return [...matches][0];
    if (matches.size > 1) return null;
  }
  return null;
}

// Every alias name, alphabetized - the source list for variety autocomplete.
export function allVarietalNames() {
  const names = new Set();
  for (const entry of VARIETALS) {
    for (const alias of entry.aliases) names.add(alias);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
