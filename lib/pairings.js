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

// A pairing's plan is a calendar day ("2026-10-04"), and everything below
// works on those day strings, never on instants, so it cannot drift with
// the timezone of whatever runs it. "Today" is passed in rather than read
// here: the server's date is UTC, which is already tomorrow for an evening
// in the Americas, so the label is worked out in the reader's own browser
// (PlanBadge) from their own local date. These functions only compare.
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function dayNumber(day) {
  if (!DAY.test(day ?? "")) return null;
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// Whole days from `today` to `day`: 0 for today, 1 for tomorrow, negative
// for a day that has passed. null when either is not a day.
export function daysFromToday(day, today) {
  const a = dayNumber(day);
  const b = dayNumber(today);
  return a === null || b === null ? null : a - b;
}

// How a planned day reads as a badge, and which kind it is:
//   "tonight"  - today
//   "upcoming" - a later day: "Tomorrow", a weekday within the week, else
//                a date
//   "queued"   - a day that has passed and was never marked done. Not
//                dropped, and not called overdue: it is still waiting its
//                turn, and nothing here chases it.
// null for no plan.
export function planLabel(day, today) {
  const diff = daysFromToday(day, today);
  if (diff === null) return null;
  if (diff === 0) return { kind: "tonight", text: "Tonight" };
  if (diff < 0) return { kind: "queued", text: "Queued" };
  if (diff === 1) return { kind: "upcoming", text: "Tomorrow" };
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const text =
    diff <= 6
      ? date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" })
      : date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
  return { kind: "upcoming", text };
}

// The list's order: planned pairings first, soonest first; then queued
// ones (the plan passed, most recent first); then everything unplanned,
// newest kept first. The server does not know the reader's date, so "has
// passed" is judged a day early - a plan for the reader's own today is
// never mistaken for a queued one, wherever they are; the cost is that a
// plan from the day before can sit among the upcoming for a few hours.
export function orderPairings(pairings, utcToday) {
  const cutoff = (dayNumber(utcToday) ?? 0) - 1;
  const day = (p) => (p.plannedFor ? dayNumber(new Date(p.plannedFor).toISOString().slice(0, 10)) : null);
  const created = (p) => new Date(p.createdAt).getTime();
  const group = (p) => (day(p) === null ? 2 : day(p) >= cutoff ? 0 : 1);
  return [...pairings].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return day(a) - day(b) || created(b) - created(a);
    if (ga === 1) return day(b) - day(a) || created(b) - created(a);
    return created(b) - created(a);
  });
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
