// Bottle sizes, in millilitres (Bottle.sizeMl). The vocabulary the size picker
// offers, and the one rule for reading a missing size.
//
// Millilitres, not names, are what is stored, so a size that is not on this
// list (500, 620) is still a valid, sortable, summable value; the list is only
// what the form suggests and what has a friendly name.

export const STANDARD_ML = 750;

export const BOTTLE_SIZES = Object.freeze([
  { ml: 187, label: "Split (187 ml)" },
  { ml: 375, label: "Half (375 ml)" },
  { ml: 500, label: "500 ml" },
  { ml: 750, label: "Standard (750 ml)" },
  { ml: 1000, label: "1 L" },
  { ml: 1500, label: "Magnum (1.5 L)" },
  { ml: 3000, label: "Double magnum (3 L)" },
  { ml: 4500, label: "Jeroboam (4.5 L)" },
  { ml: 6000, label: "Imperial (6 L)" },
]);

export const MIN_ML = 50;
export const MAX_ML = 30000;

// A size read from a form: a whole number of millilitres inside the same
// bounds the database holds it to, else null ("not recorded"). Never a guess.
export function parseSizeMl(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < MIN_ML || n > MAX_ML) return null;
  return n;
}

// How a size reads on a row or a page. Says nothing for a standard bottle or
// one with no size recorded ("say nothing when there is nothing to say"); a
// size on the list gets its short name, any other is shown in ml or litres.
export function sizeLabel(ml) {
  if (!ml || ml === STANDARD_ML) return null;
  const known = BOTTLE_SIZES.find((size) => size.ml === ml);
  if (known) return known.label.split(" (")[0];
  return ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`;
}

// Litres in a lot: bottles x size. The one place a missing size is read as
// standard, because for a total "not recorded" has to count as something and
// 750 is by far the likeliest; nothing else in the app does this.
export function litres(quantity, sizeMl) {
  return (quantity * (sizeMl ?? STANDARD_ML)) / 1000;
}
