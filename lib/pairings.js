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

// The dishes a pairing names, in order and without repeats. Empty for a
// pairing whose request was a single dish - Suggest is told to leave
// `pairingContext` null when there is only one and it is already obvious -
// which is exactly what separates a dish with one wine from a menu with
// several.
export function pairingDishes(pairing) {
  const seen = new Set();
  for (const pick of pairing.picks) {
    const dish = pick.dish?.trim();
    if (dish) seen.add(dish);
  }
  return [...seen];
}

// The line under the title in a list. Says what the pairing is for and
// which wines answered it, because "the lamb, the halibut · Rochioli, Dr.
// Loosen" is what you are scanning for and "3 wines" on its own is not
// (BACKLOG #28). Producer names only (`wineName`, not the fuller
// `wineLabel`) - a heading with the bottling and vintage too would crowd
// out the dish names it already shares a line with.
export function pairingSummaryLine(pairing) {
  const dishes = pairingDishes(pairing);
  const wines = pairing.picks.map((pick) => pick.wineName).join(", ");
  return dishes.length > 0 ? `${dishes.join(", ")} · ${wines}` : wines;
}
