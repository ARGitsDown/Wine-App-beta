// A flight's name and its "still going" state, in one place because both
// are asked for in several unrelated views.

// Neither `title` nor `summary` can be NOT NULL on its own - a flight from
// Suggest has both, one built by hand usually has only a title, and a
// flight saved before titles existed has only a summary. Writers guarantee
// at least one is set; this is the reader's side of that, with a last
// resort so a row that somehow slipped through renders as something
// clickable rather than as an empty link.
export function flightName(flight) {
  return flight.title || flight.summary || "Untitled flight";
}

// A flight worth offering as somewhere to put another bottle. One with no
// picks yet counts - that's a flight you just started and are filling.
// One whose every pick is drunk does not: it's a record now, not a queue.
export function isOpenFlight(flight) {
  if (flight.picks.length === 0) return true;
  return flight.picks.some((pick) => !pick.consumed);
}
