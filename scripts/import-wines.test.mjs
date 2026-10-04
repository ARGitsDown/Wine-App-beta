// The CSV reader and the wine importer: formats, every refusal, and that
// nothing unreadable is stored as if it were read.
import { parseCsv, detectDelimiter } from "../lib/csv.js";
import { mergeLots, lotKey, prepareImport, parseSizeText, parseYear, parseDay, duplicateKey, mapHeaders, MAX_IMPORT_ROWS } from "../lib/import-wines.js";

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`}`);
}

// ---- CSV
t("plain", parseCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);
t("CRLF and BOM", parseCsv("﻿a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
t("quoted comma, quote and newline", parseCsv('a,b\n"x, y","say ""hi""\nthere"\n'), [["a", "b"], ["x, y", 'say "hi"\nthere']]);
t("semicolon delimiter", parseCsv("a;b\n1;2"), [["a", "b"], ["1", "2"]]);
t("tab delimiter", parseCsv("a\tb\n1\t2"), [["a", "b"], ["1", "2"]]);
t("a quoted comma does not pick the delimiter", detectDelimiter('"a, b";c'), ";");
t("blank lines dropped, last row without newline kept", parseCsv("a,b\n\n1,2"), [["a", "b"], ["1", "2"]]);
t("empty trailing field", parseCsv("a,b\n1,"), [["a", "b"], ["1", ""]]);

// ---- small parsers
t("sizes", ["750ml", "0.75 L", "1.5L", "75cl", "Magnum", "375", "1,5 L", "huge", ""].map(parseSizeText), [750, 750, 1500, 750, 1500, 375, 1500, null, null]);
t("years", [parseYear("2018"), parseYear("NV"), parseYear("18"), parseYear("1700")], [2018, null, null, null]);
t("days", [parseDay("2024-03-05")?.toISOString(), parseDay("3/5/2024")?.toISOString(), parseDay("2/30/2024"), parseDay("soon")], ["2024-03-05T12:00:00.000Z", "2024-03-05T12:00:00.000Z", null, null]);
t("duplicate key ignores case, accents and spacing", duplicateKey({ producer: "Château  Margaux", bottling: null, vintage: 2015 }), duplicateKey({ producer: "chateau margaux", bottling: "", vintage: 2015 }));

// ---- a CellarTracker-shaped file
const ct = [
  "iWine,Quantity,Size,Price,Currency,Location,Bin,Vintage,Producer,Wine,Varietal,Country,Region,SubRegion,Appellation,Color,BeginConsume,EndConsume,Store,PurchaseDate",
  '1,3,750ml,$24.50,USD,Rack B,12,2018,Rochioli,Three Corner,Pinot Noir,USA,California,Sonoma,Russian River Valley,Red,2022,2032,K&L,3/5/2023',
  "2,1,1.5L,,,,,2015,Château Margaux,,Bordeaux Blend,France,Bordeaux,Margaux,Margaux,Red,2025,2060,,",
  "3,2,,18,EUR,Fridge,,NV,Bollinger,Special Cuvée,Chardonnay,France,Champagne,,,Sparkling,,,,",
  "4,1,,,,,,2010,,No producer,,,,,,,,,,",
].join("\n");
const r = prepareImport(ct);
t("parses", r.ok, true);
t("three wines, one skipped for no producer", [r.wines.length, r.skipped], [3, [{ line: 5, reason: "no producer" }]]);
const [a, b, c] = r.wines;
t("lot columns", [a.quantity, a.sizeMl, a.pricePaidCents, a.priceCurrency, a.location], [3, 750, 2450, "USD", "Rack B"]);
t("identity columns", [a.producer, a.bottling, a.vintage, a.variety, a.region, a.subRegion, a.country, a.wineColor], ["Rochioli", null, 2018, "Pinot Noir", "California", "Sonoma", "USA", "Red"]);
t("Wine (the full name) is not mistaken for a bottling", a.bottling, null);
t("window, source and acquired date", [a.drinkFrom, a.drinkTo, a.notes, a.acquiredAt.toISOString()], [2022, 2032, "Source: K&L", "2023-03-05T12:00:00.000Z"]);
t("magnum and no price", [b.sizeMl, b.pricePaidCents, b.priceCurrency, b.location], [1500, null, null, null]);
t("NV vintage is blank without a warning", [c.vintage, r.warnings.filter((w) => w.line === 4).length], [null, 0]);
t("euro price", [c.pricePaidCents, c.priceCurrency], [1800, "EUR"]);
t("what was read from which column is reported", r.mapping.find((m) => m.field === "producer").header, "Producer");
t("unused columns are listed, not hidden", r.ignored.includes("iWine") && r.ignored.includes("Bin"), true);

// ---- a Vivino-shaped file, semicolons
const vv = 'Winery;Wine name;Vintage;Region;Country;Rating\nOpus One;Overture;2019;Napa Valley;United States;4.5\n';
const v = prepareImport(vv);
t("Vivino-style: winery and wine name", [v.wines[0].producer, v.wines[0].bottling, v.wines[0].vintage, v.wines[0].quantity], ["Opus One", "Overture", 2019, 1]);

// ---- refusals and warnings
t("empty", prepareImport("   ").ok, false);
t("header only", prepareImport("Producer,Vintage\n").ok, false);
t("no producer column", prepareImport("Name,Year\nX,2019\n").error.includes("Producer"), true);
t("too many rows", prepareImport("Producer\n" + "X\n".repeat(MAX_IMPORT_ROWS + 1)).ok, false);
t("too big", prepareImport("Producer\n" + "X".repeat(900 * 1024)).ok, false);
const w = prepareImport("Producer,Vintage,Quantity,Size,Price,Currency,BeginConsume,EndConsume\nA,19xx,0,big,abc,,2030,2020\nB,2018,2,,30,JPY,,\n");
t("each unreadable value is reported by line", w.warnings.map((x) => `${x.line}:${x.text.split(" ")[0]}`), ["2:vintage", "2:quantity", "2:size", "2:price", "2:drinking", "3:price"]);
t("an unreadable value is dropped, not stored", [w.wines[0].vintage, w.wines[0].quantity, w.wines[0].sizeMl, w.wines[0].pricePaidCents, w.wines[0].drinkFrom], [null, 1, null, null, null]);
t("a price in an unsupported currency is not kept as dollars", [w.wines[1].pricePaidCents, w.wines[1].priceCurrency], [null, null]);
t("header names are matched loosely", Object.keys(mapHeaders(["  WINERY ", "Bottle Price", "Qty"]).index), ["producer", "quantity", "price"]);

// ---- lots
const per = prepareImport("Producer,Vintage,Price,Location\nA,2018,20,Rack B\nA,2018,20,rack b\nA,2018,25,Rack B\nA,2018,20,Fridge\nB,2018,20,Rack B\n");
t("identical lines merge into one lot with a quantity", per.wines.map((w) => `${w.producer}:${w.quantity}:${w.pricePaidCents}:${w.location}`), ["A:2:2000:Rack B", "A:1:2500:Rack B", "A:1:2000:Fridge", "B:1:2000:Rack B"]);
t("merge count is reported", per.merged, 1);
t("quantities never pass 999", mergeLots([{ producer: "A", quantity: 600 }, { producer: "A", quantity: 600 }]).map((w) => w.quantity), [600, 600]);
t("lot key separates price", lotKey({ producer: "A", pricePaidCents: 1 }) === lotKey({ producer: "A", pricePaidCents: 2 }), false);

const dated = prepareImport("Producer,PurchaseDate\nA,soon\nB,\nC,2024-02-03\n");
t("an unreadable date is unknown (false), a missing one is null, a good one is a date", [dated.wines[0].acquiredAt, dated.wines[1].acquiredAt, dated.wines[2].acquiredAt?.toISOString()], [false, null, "2024-02-03T12:00:00.000Z"]);
t("the unreadable date is warned about", dated.warnings.map((x) => x.text.includes("unknown")), [true]);

console.log(`import-wines: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
