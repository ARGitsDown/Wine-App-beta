// The bottle-size and lot-field rules: parsing, labels, litre totals, the
// price format. Pure functions.
import { parseSizeMl, sizeLabel, litres, BOTTLE_SIZES, STANDARD_ML } from "../lib/bottle-sizes.js";
import {
  cleanLocation,
  adoptExistingLocation,
  parsePriceCents,
  parseCurrency,
  formatPrice,
  lotLine,
  MAX_LOCATION,
} from "../lib/lot-fields.js";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${name}: got ${g}, want ${w}`); }
};

// --- size
t("a listed size parses", parseSizeMl("1500"), 1500);
t("an odd but valid size parses", parseSizeMl("620"), 620);
t("blank is not recorded, not 750", [parseSizeMl(""), parseSizeMl(null), parseSizeMl(undefined)], [null, null, null]);
t("too small, too big, fractional, text: all null", [parseSizeMl("10"), parseSizeMl("99999"), parseSizeMl("7.5"), parseSizeMl("big")], [null, null, null, null]);
t("standard says nothing", sizeLabel(750), null);
t("no size says nothing", [sizeLabel(null), sizeLabel(undefined)], [null, null]);
t("a named size is short", [sizeLabel(375), sizeLabel(1500), sizeLabel(3000)], ["Half", "Magnum", "Double magnum"]);
t("an unnamed size shows its volume", [sizeLabel(620), sizeLabel(2500)], ["620 ml", "2.5 L"]);
t("litres: three magnums", litres(3, 1500), 4.5);
t("litres: a missing size counts as standard, and only here", litres(4, null), 3);
t("the list has the standard size", BOTTLE_SIZES.some((s) => s.ml === STANDARD_ML), true);

// --- location
t("spacing is tidied", cleanLocation("  Rack   B "), "Rack B");
t("blank is null", [cleanLocation(""), cleanLocation("   "), cleanLocation(null)], [null, null, null]);
t("it is bounded", cleanLocation("x".repeat(500)).length, MAX_LOCATION);
t("a new spelling of an old place adopts the old one", adoptExistingLocation("rack b", ["Rack A", "Rack B"]), "Rack B");
t("spacing differences too", adoptExistingLocation("rack   b", ["Rack B"]), "Rack B");
t("a genuinely new place keeps the person's capitalisation", adoptExistingLocation("Wine Fridge", ["Rack B"]), "Wine Fridge");
t("nothing in, nothing out", adoptExistingLocation("  ", ["Rack B"]), null);

// --- price
t("dollars and cents", parsePriceCents("24.50"), 2450);
t("a comma decimal", parsePriceCents("24,5"), 2450);
t("a currency symbol and thousands are tolerated", parsePriceCents("$24"), 2400);
t("a gift is zero, not null", parsePriceCents("0"), 0);
t("blank is null", [parsePriceCents(""), parsePriceCents(null)], [null, null]);
t("negative or nonsense is null", [parsePriceCents("-5"), parsePriceCents("abc")], [null, null]);
t("rounds to the cent", parsePriceCents("19.999"), 2000);
t("currency: known, lower case, unknown", [parseCurrency("eur"), parseCurrency("GBP"), parseCurrency("XXX"), parseCurrency("")], ["EUR", "GBP", "USD", "USD"]);
t("formatting", [formatPrice(2450, "USD"), formatPrice(0, "EUR"), formatPrice(null)], ["$24.50", "€0.00", null]);

// --- how a lot reads
t("lot line: place, size, price", lotLine({ status: "inventory", location: "Rack B", sizeMl: 1500, pricePaidCents: 2450, priceCurrency: "USD", quantity: 3 }), "Rack B · Magnum · $24.50 each");
t("lot line: standard bottle says nothing about size", lotLine({ status: "inventory", sizeMl: 750, quantity: 1 }), "");
t("lot line: one bottle is not 'each'", lotLine({ status: "inventory", pricePaidCents: 2450, priceCurrency: "EUR", quantity: 1 }), "€24.50");
t("lot line: place only while in the cellar", lotLine({ status: "consumed", location: "Rack B", quantity: 1 }), "");
t("lot line: row view leaves price out", lotLine({ status: "inventory", location: "Fridge", pricePaidCents: 900, priceCurrency: "USD", quantity: 2 }, { withPrice: false }), "Fridge");

console.log(`lot-fields: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
