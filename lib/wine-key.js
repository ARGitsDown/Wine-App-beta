// What "the same wine" means, in one place.
//
// Producer, bottling (the vineyard or cuvee) and vintage, with case, spacing
// and accents ignored. Different vintages are different wines, and so are two
// bottlings of one producer. Grape, region and everything else are not part of
// it: they describe a wine rather than say which one it is, and each is one
// more way for two spellings of one wine to miss each other.
//
// Used wherever the app asks whether two rows are one wine: a list showing a
// wine held as more than one lot, the cellar overview's wine count, a CSV
// import telling a re-import from a new bottle, the guest list showing one row
// per wine, and the drinking-window cache (two rows of one wine share one
// estimate). The one place it cannot apply is matching a Suggest gap, which
// is only a producer and a style and has no bottling or vintage to compare -
// see setPairingPickDecision.
export function foldText(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function wineKey(bottle) {
  return [foldText(bottle.producer), foldText(bottle.bottling), bottle.vintage ?? ""].join("|");
}
