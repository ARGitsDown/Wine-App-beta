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
//   "queued"   - a day that has passed and was never cleared. Not dropped,
//                and not called overdue: it is still waiting its turn, and
//                nothing here chases it. Reads "Queued - Sep 13".
// null for no plan.
export function planLabel(day, today) {
  const diff = daysFromToday(day, today);
  if (diff === null) return null;
  if (diff === 0) return { kind: "tonight", text: "Tonight" };
  if (diff < 0) {
    // With its date: "Queued" alone does not say since when, and the full
    // date is otherwise only in a tooltip a phone never shows.
    const [qy, qm, qd] = day.split("-").map(Number);
    const when = new Date(Date.UTC(qy, qm - 1, qd)).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    });
    return { kind: "queued", text: `Queued \u00b7 ${when}` };
  }
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

// A wine that was in the cellar when the pairing was kept and is not now: its
// bottle was deleted, or has been finished or moved off the Cellar list. There
// is nothing to drink - no Drink or Hold to offer. (A gap suggestion is the
// other kind of absent wine and has its own handling; see pickNotOwned.)
export function pickGone(pick) {
  return !pick.gap && (!pick.bottle || pick.bottle.status !== "inventory");
}

// What makes two dish labels the same course: lower case, a leading "the",
// "a" or "an" dropped, punctuation and spacing ignored. The model is told to
// use one label per dish, but "The lamb" and "the lamb." are the commonest
// way it slips, and a heading per spelling is a worse page than one heading.
// Deliberately no fuzzier than that: "Lamb" and "Lamb tagine" may really be
// different courses, and a wrong merge hides one from the owner. null for no
// dish.
export function dishKey(dish) {
  const text = String(dish ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return text || null;
}

// The picks in the order they were suggested, grouped by the dish or course
// they are for. Options for the same dish sit together under one heading
// instead of repeating it on each; the heading is the first spelling seen. A
// pairing for a single dish has no dish on its picks and comes back as one
// group with a null heading. A dish that comes back later in the list joins
// its earlier group.
export function groupPicksByDish(picks) {
  const groups = [];
  const byKey = new Map();
  for (const pick of picks) {
    const label = pick.dish?.trim() || null;
    const key = dishKey(label);
    let group = byKey.get(key);
    if (!group) {
      group = { dish: label, picks: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.picks.push(pick);
  }
  return groups;
}

// The model's reason as it is stored: it is shown in full on a wine's card,
// is what the owner decides on, and is copied into a wishlist wine's source
// line, so it has to be plain, short and one paragraph. Markdown marks the
// prompt forbids but a model still sometimes writes are stripped, whitespace
// (including line breaks) collapses to single spaces, and a long one is cut
// at the last full sentence inside the limit, or at a word with an ellipsis
// when there is no sentence end to cut at.
export const MAX_REASON = 800;
export function cleanPairingReason(text, max = MAX_REASON) {
  const flat = String(text ?? "")
    .replace(/[*_`#]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentenceEnd > max * 0.5) return cut.slice(0, sentenceEnd + 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).trimEnd()}\u2026`;
}

// "1 to drink · 1 on hold · 2 undecided", as numbers; the page words them.
export function decisionCounts(picks) {
  const counts = { done: 0, drink: 0, hold: 0, undecided: 0 };
  for (const pick of picks) {
    // A wine that is no longer in the cellar cannot be chosen or decided; it
    // is left out rather than counted as undecided work (a Drink it was given
    // before it went still counts as chosen, so the record reads true).
    if (!pick.drankAt && !pick.decision && pickGone(pick)) continue;
    // Drunk is a fact that only a Drink pick can have, and it is counted as
    // done rather than as still to drink.
    if (pick.drankAt) counts.done += 1;
    else if (pick.decision === PICK_DECISION.DRINK) counts.drink += 1;
    else if (pick.decision === PICK_DECISION.HOLD) counts.hold += 1;
    else counts.undecided += 1;
  }
  return counts;
}

// How far along the choices are, as the parts of one line, with zero counts
// left out ("0 on hold" is noise). Wines already drunk lead ("2 tasted"); the
// Drink count that follows reads "to drink" while the pairing has a planned
// day, "chosen" when it has not -
// "2 to drink" on a pairing whose day was cleared read as work still to do.
// When nothing is decided the line says so: "Nothing chosen yet" for a
// planned pairing (the one that most needs a choice), else "N undecided".
// Each part is { text, strong }; strong marks the Drink count for emphasis.
export function progressParts(counts, planned) {
  const decided = counts.done + counts.drink + counts.hold;
  if (decided === 0) {
    return [{ text: planned ? "Nothing chosen yet" : `${counts.undecided} undecided`, strong: false }];
  }
  const parts = [];
  // Done first: what has already happened leads, then what is still ahead.
  if (counts.done > 0) parts.push({ text: `${counts.done} tasted`, strong: true });
  if (counts.drink > 0) {
    parts.push({ text: `${counts.drink} ${planned ? "to drink" : "chosen"}`, strong: counts.done === 0 });
  }
  if (counts.hold > 0) parts.push({ text: `${counts.hold} on hold`, strong: false });
  if (counts.undecided > 0) parts.push({ text: `${counts.undecided} undecided`, strong: false });
  return parts;
}
