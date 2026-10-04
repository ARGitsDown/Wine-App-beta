// Turning a CSV export (CellarTracker, Vivino, or a hand-made spreadsheet)
// into rows this app can store. Pure and dependency-light so the mapping,
// parsing and every refusal are tested (scripts/import-wines.test.mjs); the
// preview and the write are app/(owner)/import/actions.js.
//
// Nothing is guessed silently. A column the importer does not recognise is
// reported; a value it cannot read is dropped with a warning naming the row
// (a price in a currency this app does not hold is not stored as dollars); a
// row with no producer is skipped with the reason. What the preview shows is
// what will be written.

import { parseCsv } from "./csv.js";
import { normalizeWineColor } from "./wine-colors.js";
import { parseSizeMl } from "./bottle-sizes.js";
import { CURRENCIES, cleanLocation, parsePriceCents } from "./lot-fields.js";
import { plausibleWindow } from "./drink-window.js";

export const MAX_IMPORT_BYTES = 800 * 1024; // under the 1 MB a Server Action body may carry
export const MAX_IMPORT_ROWS = 1000;

// Normalised header (lower case, letters and digits only) -> our field. The
// first column found for a field wins, in this order; listed so a more
// specific column is preferred over a vaguer one.
const ALIASES = {
  producer: ["producer", "winery", "winemaker", "estate"],
  bottling: ["winename", "bottling", "cuvee", "vineyard", "designation"],
  vintage: ["vintage", "year"],
  quantity: ["quantity", "qty", "count", "bottles", "numberofbottles"],
  size: ["size", "bottlesize", "format", "volume"],
  price: ["price", "bottleprice", "priceperbottle", "purchaseprice", "pricepaid", "cost"],
  currency: ["currency", "pricecurrency"],
  location: ["location", "storage", "cellarlocation"],
  region: ["region", "locale"],
  subRegion: ["subregion", "appellation"],
  country: ["country"],
  variety: ["varietal", "grape", "grapes", "variety", "mastervarietal"],
  color: ["color", "colour", "winetype", "type", "category"],
  drinkFrom: ["beginconsume", "drinkfrom", "drinkingwindowstart", "drinkstart"],
  drinkTo: ["endconsume", "drinkto", "drinkingwindowend", "drinkend"],
  source: ["store", "source", "seller", "purchasedfrom", "merchant"],
  notes: ["notes", "note", "comments", "comment", "bottlenote"],
  acquired: ["purchasedate", "datepurchased", "dateacquired", "acquired", "dateadded"],
};

const FIELD_LABELS = {
  producer: "Producer",
  bottling: "Bottling",
  vintage: "Vintage",
  quantity: "Quantity",
  size: "Size",
  price: "Price per bottle",
  currency: "Currency",
  location: "Place",
  region: "Region",
  subRegion: "Sub-region",
  country: "Country",
  variety: "Variety",
  color: "Color",
  drinkFrom: "Drink from",
  drinkTo: "Drink to",
  source: "Source",
  notes: "Notes",
  acquired: "Date acquired",
};

export const normalizeHeader = (header) => String(header ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function mapHeaders(headers) {
  const normalized = headers.map(normalizeHeader);
  const index = {};
  const mapping = [];
  for (const [field, names] of Object.entries(ALIASES)) {
    for (const name of names) {
      const at = normalized.indexOf(name);
      if (at !== -1) {
        index[field] = at;
        mapping.push({ field, label: FIELD_LABELS[field], header: headers[at].trim() });
        break;
      }
    }
  }
  const used = new Set(Object.values(index));
  const ignored = headers.map((h, i) => (used.has(i) ? null : h.trim())).filter(Boolean);
  return { index, mapping, ignored };
}

// "750ml", "750 ML", "0.75 L", "1.5L", "75cl", "Magnum", "Half", "Standard".
const SIZE_WORDS = { standard: 750, half: 375, "half bottle": 375, split: 187, magnum: 1500, "double magnum": 3000, jeroboam: 4500, imperial: 6000, liter: 1000, litre: 1000 };
export function parseSizeText(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (SIZE_WORDS[text] !== undefined) return SIZE_WORDS[text];
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*(ml|cl|l|lt|ltr|liters?|litres?)?$/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  const unit = m[2] ?? (n >= 50 ? "ml" : "l");
  const ml = unit === "ml" ? n : unit === "cl" ? n * 10 : n * 1000;
  return parseSizeMl(Math.round(ml));
}

export function parseYear(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}$/.test(text)) return null;
  const n = Number(text);
  return n >= 1800 && n <= 2100 ? n : null;
}

// YYYY-MM-DD, or M/D/YYYY (the US export default), as a calendar day at noon
// UTC like every other date here. Anything else is not guessed.
export function parseDay(value) {
  const text = String(value ?? "").trim();
  let y, m, d;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, y, m, d] = match;
  else if ((match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, m, d, y] = match;
  else return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 12));
  if (date.getUTCFullYear() !== Number(y) || date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  return date;
}

function cell(row, index, field) {
  const at = index[field];
  return at === undefined ? "" : String(row[at] ?? "").trim();
}

// One data row -> { wine, warnings } or { skip }. `line` is the line number in
// the file (the header is line 1), for messages the person can find.
export function rowToWine(row, index, line) {
  const warnings = [];
  const producer = cell(row, index, "producer");
  if (!producer) return { skip: { line, reason: "no producer" } };

  const vintageText = cell(row, index, "vintage");
  const vintage = parseYear(vintageText);
  if (vintageText && vintage === null && !/^(nv|n\/v|non[- ]?vintage|mv)$/i.test(vintageText)) {
    warnings.push({ line, text: `vintage "${vintageText}" not understood, left blank` });
  }

  const quantityText = cell(row, index, "quantity");
  let quantity = 1;
  if (quantityText) {
    const n = Number(quantityText);
    if (Number.isInteger(n) && n >= 1 && n <= 999) quantity = n;
    else warnings.push({ line, text: `quantity "${quantityText}" not understood, counted as 1` });
  }

  const sizeText = cell(row, index, "size");
  const sizeMl = parseSizeText(sizeText);
  if (sizeText && sizeMl === null) warnings.push({ line, text: `size "${sizeText}" not understood, left blank` });

  let pricePaidCents = null;
  let priceCurrency = null;
  const priceText = cell(row, index, "price");
  if (priceText) {
    const cents = parsePriceCents(priceText);
    const currencyText = cell(row, index, "currency").toUpperCase();
    // The currency may also ride in the price itself ("€24", "£18").
    const symbol = priceText.includes("€") ? "EUR" : priceText.includes("£") ? "GBP" : null;
    const currency = currencyText || symbol || "USD";
    if (cents === null) warnings.push({ line, text: `price "${priceText}" not understood, left blank` });
    else if (!CURRENCIES.includes(currency)) {
      warnings.push({ line, text: `price in ${currency} skipped (only ${CURRENCIES.join(", ")} are kept)` });
    } else {
      pricePaidCents = cents;
      priceCurrency = currency;
    }
  }

  let drinkFrom = parseYear(cell(row, index, "drinkFrom"));
  let drinkTo = parseYear(cell(row, index, "drinkTo"));
  if ((drinkFrom !== null || drinkTo !== null) && !plausibleWindow({ drinkFrom, drinkTo }, vintage)) {
    warnings.push({ line, text: "drinking window looked wrong, left blank" });
    drinkFrom = null;
    drinkTo = null;
  }

  const colorText = cell(row, index, "color");
  const wineColor = normalizeWineColor(colorText) ?? normalizeWineColor(colorText.replace(/\s*wine$/i, ""));

  const source = cell(row, index, "source");
  const extra = cell(row, index, "notes");
  const notes = [source ? `Source: ${source}` : null, extra || null].filter(Boolean).join("\n") || null;

  const acquiredText = cell(row, index, "acquired");
  const acquiredAt = acquiredText ? parseDay(acquiredText) : null;
  if (acquiredText && !acquiredAt) warnings.push({ line, text: `date "${acquiredText}" not understood, today used` });

  return {
    wine: {
      producer,
      bottling: cell(row, index, "bottling") || null,
      vintage,
      variety: cell(row, index, "variety") || null,
      region: cell(row, index, "region") || null,
      subRegion: cell(row, index, "subRegion") || null,
      country: cell(row, index, "country") || null,
      wineColor,
      quantity,
      sizeMl,
      location: cleanLocation(cell(row, index, "location")),
      pricePaidCents,
      priceCurrency,
      drinkFrom,
      drinkTo,
      notes,
      acquiredAt,
    },
    warnings,
  };
}

// The same wine, for telling a re-import from a new bottle: producer,
// bottling and vintage, case and accents ignored.
export function duplicateKey(wine) {
  const fold = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return [fold(wine.producer), fold(wine.bottling), wine.vintage ?? ""].join("|");
}

// A bottle row is a lot (see the Bottle comment in prisma/schema.prisma): the
// same wine with the same size, place and price is one row with a quantity.
// A per-bottle export lists such a lot as many lines, so identical lots are
// merged here; a different price or place stays its own row. The key ignores
// case in the place so "rack b" and "Rack B" are one lot.
export function lotKey(wine) {
  return [
    duplicateKey(wine),
    wine.sizeMl ?? "",
    String(wine.location ?? "").toLowerCase(),
    wine.pricePaidCents ?? "",
    wine.priceCurrency ?? "",
  ].join("|");
}

export function mergeLots(wines) {
  const merged = [];
  const byKey = new Map();
  for (const wine of wines) {
    const key = lotKey(wine);
    const lot = byKey.get(key);
    if (lot && lot.quantity + wine.quantity <= 999) {
      lot.quantity += wine.quantity;
    } else {
      const copy = { ...wine };
      byKey.set(key, copy);
      merged.push(copy);
    }
  }
  return merged;
}

export function prepareImport(text) {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, error: "That file is empty." };
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) {
    return { ok: false, error: "That file is too big (limit 800 KB). Split it and import in parts." };
  }
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: "That file has no wine rows under its header." };
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return { ok: false, error: `That file has ${rows.length - 1} rows; the limit is ${MAX_IMPORT_ROWS}. Split it and import in parts.` };
  }
  const { index, mapping, ignored } = mapHeaders(rows[0]);
  if (index.producer === undefined) {
    return {
      ok: false,
      error: "Couldn't find a Producer (or Winery) column. The first row should be the column names.",
    };
  }
  const wines = [];
  const skipped = [];
  const warnings = [];
  rows.slice(1).forEach((row, i) => {
    const result = rowToWine(row, index, i + 2);
    if (result.skip) skipped.push(result.skip);
    else {
      wines.push(result.wine);
      warnings.push(...result.warnings);
    }
  });
  const lots = mergeLots(wines);
  return { ok: true, mapping, ignored, wines: lots, merged: wines.length - lots.length, skipped, warnings };
}
