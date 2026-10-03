// Pins the stored words (they are in the database - changing one is a
// migration, not a rename) and keeps the code spelling them from
// lib/roles.js and lib/usage-features.js rather than as string literals.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROLE, ROLE_VALUES, ACCESS, ACCESS_VALUES } from "../lib/roles.js";
import { FEATURE, FEATURE_VALUES, HELD_FEATURES } from "../lib/usage-features.js";
import { INVITE_ACCESS_OPTIONS, INVITE_ACCESS_VALUES } from "../lib/invite-access.js";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${name}: got ${g}, want ${w}`); }
};

// --- the stored values
t("roles", [...ROLE_VALUES].sort(), ["cellarmaster", "guest"]);
t("access", [...ACCESS_VALUES].sort(), ["cellarmaster", "guest", "separate"]);
t("every role is an access value", [...ROLE_VALUES].every((r) => ACCESS_VALUES.has(r)), true);
t("features", [...FEATURE_VALUES].sort(), ["estimate-windows", "photo-details", "research", "scan", "suggest"]);
t("held features", [...HELD_FEATURES].sort(), ["estimate-windows", "scan"]);
t("every held feature is a feature", [...HELD_FEATURES].every((f) => FEATURE_VALUES.has(f)), true);
t("the invite form offers exactly the access values", INVITE_ACCESS_OPTIONS.map((o) => o.value).sort(), [...ACCESS_VALUES].sort());
t("...and the action checks the same set", INVITE_ACCESS_VALUES === ACCESS_VALUES, true);
t("the constants can't be reassigned", (() => { try { "use strict"; ROLE.GUEST = "x"; } catch {} return ROLE.GUEST; })(), "guest");

// --- no raw literals in the code that should be using them
const roots = ["app", "lib"];
const skip = new Set(["generated", "node_modules", ".next"]);
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|mjs)$/.test(name)) files.push(path);
  }
};
for (const r of roots) walk(new URL(`../${r}`, import.meta.url).pathname);

const allowed = (path) => path.endsWith("lib/roles.js") || path.endsWith("lib/usage-features.js");
// Code lines only: a comment may name a role in prose.
const codeLines = (path) =>
  readFileSync(path, "utf8").split("\n").map((text, i) => ({ text, n: i + 1 }))
    .filter(({ text }) => !/^\s*(\/\/|\*|\/\*)/.test(text));

const offenders = [];
for (const path of files) {
  if (allowed(path)) continue;
  for (const { text, n } of codeLines(path)) {
    if (/\b(role|access)\b[^\n]*["'](cellarmaster|guest|separate)["']/.test(text) ||
        /["'](cellarmaster|guest|separate)["']\s*[:)]/.test(text) && /role|access/.test(text) ||
        /\bfeature\b\s*[:=]\s*["'](scan|suggest|research|estimate-windows|photo-details)["']/.test(text)) {
      offenders.push(`${path.replace(/.*\/(app|lib)\//, "$1/")}:${n}  ${text.trim()}`);
    }
  }
}
t("no raw role/access/feature literals in app/ or lib/", offenders, []);

console.log(`constants: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
