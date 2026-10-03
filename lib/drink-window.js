// The drinking window, as one short phrase - reused wherever a wine's name
// appears rather than each place inventing its own (BACKLOG #29 finding
// 1). The three-way split (past its window, inside it, not ready yet)
// mirrors lib/filter-bottles.js's own drinkUrgency, which sorts by the
// same boundaries, so the sort and the label on screen never disagree
// about which bucket a bottle is in.
//
// Returns null, not "No window", when neither year is on file - a blank
// line reads as nothing recorded, the same convention wineOrigin() already
// uses for a bottle with no region, and this sits right beside it.
export function drinkWindowLabel(bottle) {
  const { drinkFrom, drinkTo, drinkWindowEstimated } = bottle;
  if (drinkFrom == null && drinkTo == null) return null;

  const currentYear = new Date().getFullYear();
  let text;
  if (drinkTo != null && currentYear > drinkTo) {
    text = `Past peak (to ${drinkTo})`;
  } else if (drinkFrom != null && currentYear < drinkFrom) {
    text = `Ready ${drinkFrom}`;
  } else if (drinkTo != null) {
    text = `Drink by ${drinkTo}`;
  } else {
    // Only a start year is on file and it has already arrived - open
    // ended, so there's no "by" year to give.
    text = `Ready since ${drinkFrom}`;
  }

  // Same weight as the rest of the phrase, not lighter - "estimated" is
  // the word doing the work here, and greying it out undoes that.
  return drinkWindowEstimated ? `${text} · estimated` : text;
}

// Whether a drinking window a model proposed is believable enough to save
// - and, worse, to *cache*: estimates are stored under a key with no
// Domaine in it and answer every Domaine that ever meets that wine, so one
// bad answer is repeated forever (BACKLOG #55).
//
// The tool's strict schema guarantees an integer comes back, not the right
// one - it can't express a minimum or a maximum, and it can't notice an
// answer shifted onto the wrong row of a 20-wine batch. A window that ends
// before it starts, opens before the wine existed, or runs a century past
// its vintage is a misread or a misaligned row, not an estimate, and is
// dropped rather than written. A year outside 1800-2300 is dropped with
// no vintage to compare against. Either end may be null (a half-open
// window is legitimate), and with no vintage on file only the order and
// range checks can apply.
export function plausibleWindow({ drinkFrom, drinkTo }, vintage) {
  const years = [drinkFrom, drinkTo].filter((year) => year != null);
  if (years.some((year) => !Number.isInteger(year) || year < 1800 || year > 2300)) return false;
  if (drinkFrom != null && drinkTo != null && drinkTo < drinkFrom) return false;
  if (vintage) {
    if (drinkFrom != null && drinkFrom < vintage) return false;
    if (drinkTo != null && drinkTo > vintage + 100) return false;
  }
  return true;
}
