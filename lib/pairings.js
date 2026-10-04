// How a saved pairing reads: the name of a wine in it, and the one line
// that describes the whole thing in a list.
//
// A plain module rather than part of app/actions.js because that file is
// "use server", where every export has to be an async Server Action -
// same reason lib/flights.js exists beside the flight actions.

// The label written into PairingPick.wineLabel when the pairing is kept.
// Built from the bottle row at that moment, which is the whole point: the
// column is a snapshot, so a wine renamed or deleted later still shows the
// name it was chosen under.
export function wineLabelForBottle(bottle) {
  const name = [
    bottle.producer,
    bottle.bottling ? `“${bottle.bottling}”` : null,
    bottle.vintage || null,
  ]
    .filter(Boolean)
    .join(" ");
  return bottle.type ? `${name} — ${bottle.type}` : name;
}

// The same, for a wine the owner does not own. Producer and style are all
// a gap suggestion has that identifies it; region and country are shown
// separately on the card rather than crammed into the heading.
export function wineLabelForGap(gap) {
  return [gap?.producer, gap?.type].filter(Boolean).join(" — ");
}

// The producer alone - written into PairingPick.wineName alongside the
// full wineLabel, for a list summary that has to share a line with two or
// three dish names. `bottle.producer` is a live field, not a snapshot, but
// that's fine here: it's read once, at the moment the pairing is kept, and
// stored - after that it's exactly as frozen as wineLabel is.
export function wineNameForBottle(bottle) {
  return bottle.producer;
}

// gapFromInput (app/actions.js) never returns a gap without a producer -
// it's the one required field - so this is never null in practice, but the
// signature matches wineNameForBottle's rather than assume that call site
// stays the only caller.
export function wineNameForGap(gap) {
  return gap?.producer ?? "";
}

// What the "Tonight" badge should actually say. plannedForTonight itself
// never clears on its own (see the schema comment) - only the owner's own
// "Done for tonight" does that - so without this a pairing marked three
// weeks ago and never followed up on would go on claiming "Tonight"
// indefinitely (a UX review, 2026-09-27). null means don't show a badge
// at all; plannedForTonightAt is null on any pairing marked before this
// field existed, which still reads as "Tonight" rather than showing no
// date at all.
export function tonightLabel(pairing) {
  if (!pairing.plannedForTonight) return null;
  if (!pairing.plannedForTonightAt) return "Tonight";
  const marked = new Date(pairing.plannedForTonightAt);
  const sameDay = marked.toDateString() === new Date().toDateString();
  if (sameDay) return "Tonight";
  return `Planned ${marked.toLocaleDateString(undefined, { month: "short", day: "numeric" })} — done?`;
}

// What a pick can be decided as. Stored words (PairingPick.decision), so
// changing one is a migration, not a rename. Undecided is not in the list:
// it is NULL, and the absence of a choice.
export const PICK_DECISION = Object.freeze({ DRINK: "drink", HOLD: "hold" });
export const PICK_DECISION_VALUES = new Set(Object.values(PICK_DECISION));

// A pick is "not owned" while it is a gap suggestion with no bottle, or
// only a wishlist bottle made from it (choosing Drink does that); once the
// bottle is in the cellar it is an ordinary owned wine again.
export function pickNotOwned(pick) {
  return Boolean(pick.gap) && (!pick.bottle || pick.bottle.status === "wishlist");
}

// The picks in the order they were suggested, grouped by the dish or course
// they are for. Options for the same dish sit together under one heading
// instead of repeating it on each; a pairing for a single dish has no dish
// on its picks and comes back as one group with a null heading. A dish
// that comes back later in the list joins its earlier group.
export function groupPicksByDish(picks) {
  const groups = [];
  const byDish = new Map();
  for (const pick of picks) {
    const dish = pick.dish?.trim() || null;
    let group = byDish.get(dish);
    if (!group) {
      group = { dish, picks: [] };
      byDish.set(dish, group);
      groups.push(group);
    }
    group.picks.push(pick);
  }
  return groups;
}

// "1 to drink · 1 on hold · 2 undecided", as numbers; the page words them.
export function decisionCounts(picks) {
  const counts = { drink: 0, hold: 0, undecided: 0 };
  for (const pick of picks) {
    if (pick.decision === PICK_DECISION.DRINK) counts.drink += 1;
    else if (pick.decision === PICK_DECISION.HOLD) counts.hold += 1;
    else counts.undecided += 1;
  }
  return counts;
}
