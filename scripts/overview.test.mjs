// The cellar overview's arithmetic and the drinking-window buckets it, the
// filter and the sort all share.
import { summarizeCellar, readyNowText } from "../lib/cellar-overview.js";
import { windowBucket } from "../lib/drink-window.js";

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`}`);
}

const Y = 2026;
t("past", windowBucket({ drinkFrom: 2015, drinkTo: 2025 }, Y), "past");
t("ready: inside", windowBucket({ drinkFrom: 2020, drinkTo: 2030 }, Y), "ready");
t("ready: last year of the window", windowBucket({ drinkFrom: 2020, drinkTo: 2026 }, Y), "ready");
t("ready: open-ended and begun", windowBucket({ drinkFrom: 2020, drinkTo: null }, Y), "ready");
t("ready: only an end year, still ahead", windowBucket({ drinkFrom: null, drinkTo: 2030 }, Y), "ready");
t("later", windowBucket({ drinkFrom: 2028, drinkTo: 2040 }, Y), "later");
t("none", windowBucket({ drinkFrom: null, drinkTo: null }, Y), "none");

const bottles = [
  { quantity: 3, sizeMl: 750, wineColor: "Red", region: "Bordeaux", location: "Rack B", drinkFrom: 2020, drinkTo: 2030, drinkWindowEstimated: true },
  { quantity: 1, sizeMl: 1500, wineColor: "Red", region: "Bordeaux", location: "Rack B", drinkFrom: 2024, drinkTo: 2035, drinkWindowEstimated: false },
  { quantity: 2, sizeMl: null, wineColor: "White", region: "Loire", location: null, drinkFrom: 2010, drinkTo: 2020 },
  { quantity: 1, sizeMl: 375, wineColor: null, region: null, location: "Fridge", drinkFrom: null, drinkTo: null },
];
const s = summarizeCellar(bottles, Y);
t("wines are rows, bottles sum quantity", [s.wines, s.bottles], [4, 7]);
t("litres: 3x0.75 + 1.5 + 2x0.75(unrecorded as standard) + 0.375 (rounded to 2 dp)", s.litres, 5.63);
t("window counts", s.window, { ready: 2, past: 1, later: 0, none: 1 });
t("estimated is a share of ready", s.readyEstimated, 1);
t("colours, most first, blanks skipped", s.colors, [{ key: "Red", count: 2 }, { key: "White", count: 1 }]);
t("regions", s.regions, [{ key: "Bordeaux", count: 2 }, { key: "Loire", count: 1 }]);
t("places and unplaced", [s.locations, s.unplaced], [[{ key: "Rack B", count: 2 }, { key: "Fridge", count: 1 }], 1]);
t("top regions is capped", summarizeCellar(Array.from({ length: 9 }, (_, i) => ({ quantity: 1, region: `R${i}` })), Y).regions.length, 6);
t("empty cellar", summarizeCellar([], Y).wines, 0);
t("ready text", [readyNowText(8), readyNowText(0)], ["8 ready now", null]);

console.log(`overview: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
