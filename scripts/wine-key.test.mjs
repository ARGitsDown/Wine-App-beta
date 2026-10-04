import { wineKey, foldText } from "../lib/wine-key.js";
import { drinkWindowCacheKey } from "../lib/drink-window-cache.js";
import { wineSiblingKey } from "../lib/lot-fields.js";

let passed = 0, failed = 0;
function check(name, ok) {
  if (ok) { passed++; console.log("PASS ", name); } else { failed++; console.log("FAIL ", name); }
}
const base = { producer: "Domaine Léon", bottling: "Les Vignes", vintage: 2019 };
check("case, spacing and accents are ignored", wineKey(base) === wineKey({ producer: " domaine  leon ", bottling: "LES VIGNES", vintage: 2019 }));
check("a different vintage is a different wine", wineKey(base) !== wineKey({ ...base, vintage: 2020 }));
check("a different bottling is a different wine", wineKey(base) !== wineKey({ ...base, bottling: "Clos du Roi" }));
check("a missing bottling is its own wine", wineKey(base) !== wineKey({ ...base, bottling: null }));
check("grape and region do not matter", wineKey({ ...base, type: "Pinot Noir", region: "Burgundy" }) === wineKey({ ...base, type: "Gamay", region: "Beaujolais" }));
check("no vintage keys consistently", wineKey({ producer: "A" }) === wineKey({ producer: "a", vintage: null }));
check("the cache and the lots list use the same key", drinkWindowCacheKey(base) === wineKey(base) && wineSiblingKey(base) === wineKey(base));
check("foldText folds", foldText("  Rosé  ") === "rose");
console.log(`wine-key: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
