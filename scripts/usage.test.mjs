import { costMicros, canonicalModelId, WEB_SEARCH_MICROS } from "../lib/usage-pricing.js";
import {
  defaultLimits,
  formatCents,
  formatMicros,
  formatResetDate,
  monthStartUTC,
  nextMonthStartUTC,
  usageState,
} from "../lib/usage-policy.js";
import { EXTRACTION_MODEL, LIGHTER_MODEL, REASONING_MODEL, requestShape } from "../lib/ai-models.js";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${name}: got ${g}, want ${w}`); }
};

// --- Cost, worked out by hand from the published per-MTok rates.
// $/MTok is exactly micros/token, so these are plain multiplications.
t("sonnet: 1000 in + 500 out", costMicros("claude-sonnet-5", { input_tokens: 1000, output_tokens: 500 }),
  { micros: 1000 * 2 + 500 * 10, assumed: false });
t("opus with cache read and 5m write",
  costMicros("claude-opus-5", { input_tokens: 200, output_tokens: 1000, cache_read_input_tokens: 5000, cache_creation_input_tokens: 2000 }).micros,
  200 * 5 + 1000 * 25 + 5000 * 0.5 + 2000 * 6.25);
t("opus: 1h cache writes priced at their own rate",
  costMicros("claude-opus-5", { cache_creation_input_tokens: 1000, cache_creation: { ephemeral_5m_input_tokens: 600, ephemeral_1h_input_tokens: 400 } }).micros,
  600 * 6.25 + 400 * 10);
t("1h figure larger than the total can't go negative",
  costMicros("claude-opus-5", { cache_creation_input_tokens: 100, cache_creation: { ephemeral_1h_input_tokens: 999 } }).micros,
  100 * 10);
t("web searches at $10 per 1,000", costMicros("claude-sonnet-5", { server_tool_use: { web_search_requests: 3 } }).micros, 3 * WEB_SEARCH_MICROS);
t("haiku, dated id from the API", costMicros("claude-haiku-4-5-20251001", { input_tokens: 1000, output_tokens: 1000 }),
  { micros: 1000 * 1 + 1000 * 5, assumed: false });
t("canonical id strips only a trailing date", canonicalModelId("claude-haiku-4-5-20251001"), "claude-haiku-4-5");
t("canonical id leaves a plain id alone", canonicalModelId("claude-sonnet-5"), "claude-sonnet-5");
t("unknown model priced as the dearest, and flagged",
  costMicros("claude-future-9", { input_tokens: 100, output_tokens: 100 }),
  { micros: 100 * 5 + 100 * 25, assumed: true });
t("no usage at all is free", costMicros("claude-sonnet-5", undefined), { micros: 0, assumed: false });
t("nulls and junk count as zero",
  costMicros("claude-sonnet-5", { input_tokens: null, output_tokens: "x", cache_read_input_tokens: -5 }).micros, 0);
t("a typical drinking-window call is a fraction of a cent",
  costMicros("claude-sonnet-5", { input_tokens: 900, output_tokens: 700 }).micros < 10_000, true);
t("row is capped below the INTEGER column's limit",
  costMicros("claude-opus-5", { output_tokens: 1e12 }).micros, 2_000_000_000);

// --- Where a Domaine stands. 1 cent = 10,000 micros.
const cents = (c) => c * 10_000;
t("no limits at all: always ok", usageState({ spentMicros: cents(1e6), capCents: null, hardStopCents: null }), "ok");
t("under the cap", usageState({ spentMicros: cents(499), capCents: 500, hardStopCents: 1500 }), "ok");
t("exactly at the cap is over it", usageState({ spentMicros: cents(500), capCents: 500, hardStopCents: 1500 }), "lighter");
t("between cap and hard stop", usageState({ spentMicros: cents(1499), capCents: 500, hardStopCents: 1500 }), "lighter");
t("exactly at the hard stop", usageState({ spentMicros: cents(1500), capCents: 500, hardStopCents: 1500 }), "stopped");
t("hard stop wins past both", usageState({ spentMicros: cents(9999), capCents: 500, hardStopCents: 1500 }), "stopped");
t("cap but no hard stop never stops", usageState({ spentMicros: cents(9999), capCents: 500, hardStopCents: null }), "lighter");
t("hard stop but no cap: ok until it", usageState({ spentMicros: cents(100), capCents: null, hardStopCents: 1500 }), "ok");
t("hard stop but no cap: stops at it", usageState({ spentMicros: cents(1500), capCents: null, hardStopCents: 1500 }), "stopped");
t("a cap of zero is over immediately", usageState({ spentMicros: 0, capCents: 0, hardStopCents: null }), "lighter");
t("garbage spend counts as zero", usageState({ spentMicros: NaN, capCents: 500, hardStopCents: 1500 }), "ok");

// --- The month boundary, in UTC
t("month start", monthStartUTC(new Date("2026-09-30T23:59:59Z")).toISOString(), "2026-09-01T00:00:00.000Z");
t("month start, first instant", monthStartUTC(new Date("2026-10-01T00:00:00Z")).toISOString(), "2026-10-01T00:00:00.000Z");
t("next month", nextMonthStartUTC(new Date("2026-09-30T23:59:59Z")).toISOString(), "2026-10-01T00:00:00.000Z");
t("next month across the year", nextMonthStartUTC(new Date("2026-12-15T12:00:00Z")).toISOString(), "2027-01-01T00:00:00.000Z");
t("reset date reads as a person would say it", formatResetDate(new Date("2026-10-01T00:00:00Z")), "1 October");

// --- Defaults for a new Domaine
t("defaults: $5, hard stop 3x", defaultLimits({}), { monthlySpendCapCents: 500, monthlyHardStopCents: 1500 });
t("cap from the environment", defaultLimits({ USAGE_DEFAULT_CAP_CENTS: "1000" }), { monthlySpendCapCents: 1000, monthlyHardStopCents: 3000 });
t("multiplier from the environment", defaultLimits({ USAGE_HARD_STOP_MULTIPLIER: "2" }), { monthlySpendCapCents: 500, monthlyHardStopCents: 1000 });
t("junk cap falls back", defaultLimits({ USAGE_DEFAULT_CAP_CENTS: "lots" }), { monthlySpendCapCents: 500, monthlyHardStopCents: 1500 });
t("negative cap falls back", defaultLimits({ USAGE_DEFAULT_CAP_CENTS: "-5" }), { monthlySpendCapCents: 500, monthlyHardStopCents: 1500 });
t("a multiplier below 1 would put the stop under the cap - falls back", defaultLimits({ USAGE_HARD_STOP_MULTIPLIER: "0.5" }), { monthlySpendCapCents: 500, monthlyHardStopCents: 1500 });
t("fractional cap falls back", defaultLimits({ USAGE_DEFAULT_CAP_CENTS: "2.5" }), { monthlySpendCapCents: 500, monthlyHardStopCents: 1500 });

// --- Money for people
t("zero", formatMicros(0), "$0.00");
t("first call or two", formatMicros(3_000), "under $0.01");
t("a cent", formatMicros(10_000), "$0.01");
t("forty-two cents", formatMicros(420_000), "$0.42");
t("cents to dollars", formatCents(500), "$5.00");

// --- The model downgrade
const reasoning = requestShape("reasoning", { effort: "high" });
t("reasoning normally: Opus, thinking and effort", [reasoning.model, reasoning.params, reasoning.webSearchType, reasoning.lighter],
  ["claude-opus-5-5", { thinking: { type: "adaptive" }, output_config: { effort: "high" } }, "web_search_20260318", false]);
const reasoningDown = requestShape("reasoning", { lighter: true, effort: "high" });
t("reasoning over the cap: one tier down to Sonnet, still thinking", [reasoningDown.model, reasoningDown.params.thinking, reasoningDown.lighter],
  ["claude-sonnet-5-5", { type: "adaptive" }, true]);
const extraction = requestShape("extraction", { effort: "xhigh" });
t("extraction normally: Sonnet, the requested effort", [extraction.model, extraction.params.output_config],
  ["claude-sonnet-5-5", { effort: "xhigh" }]);
const extractionDown = requestShape("extraction", { lighter: true, effort: "xhigh" });
t("extraction over the cap: Haiku", extractionDown.model, LIGHTER_MODEL);
t("Haiku gets neither thinking nor effort, which it doesn't take", extractionDown.params, {});
t("Haiku gets the basic web search tool", extractionDown.webSearchType, "web_search_20250305");
t("Sonnet keeps the newer web search tool", requestShape("reasoning", { lighter: true }).webSearchType, "web_search_20260318");
t("an effort level the API doesn't know falls back, not 400s",
  requestShape("extraction", { effort: "ludicrous" }).params.output_config, { effort: "high" });
let threw = false;
try { requestShape("nonsense"); } catch { threw = true; }
t("an unknown tier is a bug, loudly", threw, true);

// --- Every model the app can send is priced (an unpriced one is recorded at
// the fallback's higher price and marked assumed)
t("the app's three models", [EXTRACTION_MODEL, REASONING_MODEL, LIGHTER_MODEL], ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5"]);
for (const model of [EXTRACTION_MODEL, REASONING_MODEL, LIGHTER_MODEL]) {
  t(`${model} has a rate row`, costMicros(model, { input_tokens: 1000, output_tokens: 1000 }).assumed, false);
}
t("Opus 5.5 is priced at $4 / $20 per MTok", costMicros(REASONING_MODEL, { input_tokens: 1_000_000, output_tokens: 1_000_000 }).micros, 24_000_000);
t("Sonnet 5.5 is priced at $2 / $10 per MTok", costMicros(EXTRACTION_MODEL, { input_tokens: 1_000_000, output_tokens: 1_000_000 }).micros, 12_000_000);

console.log(`usage: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
