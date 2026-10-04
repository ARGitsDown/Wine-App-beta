// Reading the three "lot" fields off a form: where a bottle is, what it cost,
// and what currency. Pure functions, so the rules can be tested without a
// database or a request (see scripts/lot-fields.test.mjs).
import { sizeLabel } from "./bottle-sizes.js";
import { wineKey } from "./wine-key.js";

export const CURRENCIES = Object.freeze(["USD", "EUR", "GBP", "CAD", "AUD", "CHF"]);
export const DEFAULT_CURRENCY = "USD";
export const MAX_LOCATION = 80;
// The most bottles one lot (one row) holds: a form, an import, a stepper.
export const MAX_LOT_QUANTITY = 999;

// "  rack   b " -> "rack b". Null for nothing at all. Spacing is the only thing
// fixed here; the case is settled against what is already on file
// (adoptExistingLocation), so a person's own capitalisation is kept for a new
// place and an old spelling wins for an old one.
export function cleanLocation(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LOCATION);
  return text || null;
}

// A new place that differs from an existing one only in capitalisation or
// spacing files under the existing spelling, so "rack b" and "Rack B" cannot
// become two shelves of the same rack.
export function adoptExistingLocation(location, existing) {
  const clean = cleanLocation(location);
  if (!clean) return null;
  const key = clean.toLowerCase();
  const match = existing.find((name) => name.toLowerCase() === key);
  return match ?? clean;
}

// "24.50", "24,5", "$24" -> 2450 cents. Null for blank or anything that is
// not a non-negative amount; 0 is allowed (a gift). Whole minor units: a
// currency without them (yen) is not offered, because x100 would be wrong.
export function parsePriceCents(value) {
  if (/^\s*-/.test(String(value ?? ""))) return null;
  const text = String(value ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > 10000000) return null;
  return Math.round(n * 100);
}

export function parseCurrency(value) {
  const code = String(value ?? "").trim().toUpperCase();
  return CURRENCIES.includes(code) ? code : DEFAULT_CURRENCY;
}

// 2450 USD -> "$24.50". For display; the stored value stays integer cents.
export function formatPrice(cents, currency = DEFAULT_CURRENCY) {
  if (cents === null || cents === undefined) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

// The lot as it reads on the wine's page: "Rack B · Magnum · $24.50 each".
// Says nothing for a field that is not recorded, and nothing about a standard
// bottle. Location only while the bottle is in the cellar. `withPrice` is off
// on a row of a list, where price is not what you scan by.
export function lotLine(bottle, { withPrice = true } = {}) {
  const parts = [];
  if (bottle.status === "inventory" && bottle.location) parts.push(bottle.location);
  const size = sizeLabel(bottle.sizeMl);
  if (size) parts.push(size);
  if (withPrice && bottle.pricePaidCents != null) {
    const price = formatPrice(bottle.pricePaidCents, bottle.priceCurrency || DEFAULT_CURRENCY);
    parts.push(bottle.quantity > 1 ? `${price} each` : price);
  }
  return parts.join(" · ");
}

// Rows of the same wine share a key (see lib/wine-key.js), so a list can tell
// that a wine is held as more than one lot and say how the lots differ.
export const wineSiblingKey = wineKey;
