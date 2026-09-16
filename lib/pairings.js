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

// The line under the title in a list. Says what the pairing is for before
// how big it is, because "the lamb, the halibut" is what you are scanning
// for and "3 wines" is not.
export function pairingSummaryLine(pairing) {
  const count = pairing.picks.length;
  const wines = `${count} ${count === 1 ? "wine" : "wines"}`;
  const dishes = pairingDishes(pairing);
  return dishes.length > 0 ? `${dishes.join(", ")} · ${wines}` : wines;
}
