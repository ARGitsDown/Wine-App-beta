import { plausibleWindow } from "../lib/drink-window.js";
import { holdOwnersWindow } from "../lib/research-fields.js";
import { BROWSE_CELLAR_TOOL, SUGGESTIONS_TOOL, SUGGESTION_PICK_SCHEMA, buildSuggestSystemPrompt } from "../lib/suggest-prompt.js";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${name}: got ${g}, want ${w}`); }
};

// --- plausibleWindow: a model's drinking window, before it is saved AND cached for every Domaine
t("ordinary window", plausibleWindow({ drinkFrom: 2025, drinkTo: 2035 }, 2019), true);
t("opens the year it was made", plausibleWindow({ drinkFrom: 2019, drinkTo: 2030 }, 2019), true);
t("opens before the wine existed", plausibleWindow({ drinkFrom: 2015, drinkTo: 2030 }, 2019), false);
t("ends before it starts (a shifted row)", plausibleWindow({ drinkFrom: 2030, drinkTo: 2025 }, 2019), false);
t("same year start and end is fine", plausibleWindow({ drinkFrom: 2026, drinkTo: 2026 }, 2019), true);
t("runs 100 years past the vintage: the limit", plausibleWindow({ drinkFrom: 2025, drinkTo: 2119 }, 2019), true);
t("runs more than a century past the vintage", plausibleWindow({ drinkFrom: 2025, drinkTo: 2120 }, 2019), false);
t("half-open: only a start", plausibleWindow({ drinkFrom: 2025, drinkTo: null }, 2019), true);
t("half-open: only an end", plausibleWindow({ drinkFrom: null, drinkTo: 2035 }, 2019), true);
t("no vintage on file: order still checked", plausibleWindow({ drinkFrom: 2030, drinkTo: 2025 }, null), false);
t("no vintage on file: otherwise fine", plausibleWindow({ drinkFrom: 2025, drinkTo: 2035 }, null), true);
t("a year before 1800 is a misread", plausibleWindow({ drinkFrom: 202, drinkTo: 2035 }, null), false);
t("a year past 2300 is a misread", plausibleWindow({ drinkFrom: 2025, drinkTo: 20350 }, null), false);
t("a non-integer year is refused", plausibleWindow({ drinkFrom: 2025.5, drinkTo: 2035 }, null), false);
t("a string year is refused", plausibleWindow({ drinkFrom: "2025", drinkTo: 2035 }, null), false);
t("both null is not this check's business", plausibleWindow({ drinkFrom: null, drinkTo: null }, 2019), true);

// --- holdOwnersWindow: research may improve an estimate, never overwrite what a person typed or sourced
const answer = { vintage: 2019, drinkFrom: 2030, drinkTo: 2040, drinkWindowEstimated: true, criticNotes: "x" };
t("owner-typed window is put back", holdOwnersWindow(answer, { drinkFrom: 2024, drinkTo: 2028, drinkWindowEstimated: false }),
  { vintage: 2019, drinkFrom: 2024, drinkTo: 2028, drinkWindowEstimated: false, criticNotes: "x" });
t("...and is still marked as not an estimate, whatever the model said",
  holdOwnersWindow({ ...answer, drinkWindowEstimated: true }, { drinkFrom: 2024, drinkTo: null, drinkWindowEstimated: false }).drinkWindowEstimated, false);
t("a half-open owner window is held too", holdOwnersWindow(answer, { drinkFrom: 2024, drinkTo: null, drinkWindowEstimated: false }).drinkTo, null);
t("an estimated window may be improved", holdOwnersWindow(answer, { drinkFrom: 2024, drinkTo: 2028, drinkWindowEstimated: true }), answer);
t("no window at all: research fills it", holdOwnersWindow(answer, { drinkFrom: null, drinkTo: null, drinkWindowEstimated: false }), answer);
t("other fields are never touched", holdOwnersWindow(answer, { drinkFrom: 2024, drinkTo: 2028, drinkWindowEstimated: false }).criticNotes, "x");
t("the model's answer object is not mutated", (() => { const a = { ...answer }; holdOwnersWindow(a, { drinkFrom: 1, drinkTo: 2, drinkWindowEstimated: false }); return a; })(), answer);

// --- the Suggest prompt and tools: shared by the app and by scripts/compare-suggest-models.mjs
const props = SUGGESTIONS_TOOL.input_schema.properties;
t("both Suggest tools stay strict", [BROWSE_CELLAR_TOOL.strict, SUGGESTIONS_TOOL.strict], [true, true]);
t("the estimated-window rule is in the summary description", /estimate/.test(props.summary.description), true);
t("...and in the pick's reason description", /estimate/.test(SUGGESTION_PICK_SCHEMA.properties.reason.description), true);
t("prompt tells the model to browse with no filters first", /browse_cellar with no filters first/.test(buildSuggestSystemPrompt(2026, false, "balanced")), true);
t("prompt carries the year it was given", /current year is 2031/.test(buildSuggestSystemPrompt(2031, false, "balanced")), true);
t("outside-the-cellar changes the prompt", buildSuggestSystemPrompt(2026, true, "balanced") !== buildSuggestSystemPrompt(2026, false, "balanced"), true);

console.log(`ai-guards: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
