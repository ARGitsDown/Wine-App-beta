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
