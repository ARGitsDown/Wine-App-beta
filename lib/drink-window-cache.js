// The identity of a wine for drinking-window purposes: two bottles of the same
// wine share one estimate. "The same wine" is the app's one definition (see
// lib/wine-key.js): producer, bottling and vintage, accents and case ignored.
//
// It used to also include grape and region, to keep two producers who share a
// name apart. That is the rare case, and the cost of every extra field is two
// spellings of one wine missing each other and paying for the same question
// twice; a 2015 and a 2016 are still different questions, as are a producer's
// estate and single-vineyard bottlings.
import { wineKey } from "./wine-key.js";

export const drinkWindowCacheKey = wineKey;
