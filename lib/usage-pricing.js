// What a Claude call cost, in millionths of a US dollar ("micros").
//
// Plain data and arithmetic with no imports, so scripts/usage.test.mjs can
// run it without a database or the SDK - and so a client component could
// too, should anything ever need to.
//
// Why micros: a token priced at $5 per million tokens is exactly 5 micros
// per token, so every rate below is both the published $/MTok figure and
// the cost of one token, and the arithmetic needs no unit conversion to
// get wrong. It's also the only unit fine enough to sum honestly - a
// drinking-window estimate costs about 0.3 of a cent, and rounding each
// call to whole cents would add up to nothing.
//
// The rates are copied from Anthropic's published pricing, not derived
// from anything, and they drift - which is the whole reason the cost is
// computed and *stored* per call at write time (UsageEvent.costMicros)
// rather than recomputed from tokens later: a repricing must not quietly
// rewrite last month. When a model is repriced or this app moves to a
// new one, add or change a row here and bump RATES_AS_OF; old ledger rows
// keep the price they were written at.
export const RATES_AS_OF = "2026-09-25";
export const PRICING_SOURCE = "https://platform.claude.com/docs/en/about-claude/pricing";

// $ per million tokens == micros per token.
//   cacheWrite5m  - writing a 5-minute cache entry (1.25x input)
//   cacheWrite1h  - writing a 1-hour entry (2x input)
//   cacheRead     - serving tokens from cache (0.1x input; 0.05x on Opus 5.5)
// This app only ever asks for the default 5-minute entries, but the API
// reports 1-hour writes separately and a ledger that mispriced them the
// day someone turned that on would be wrong without any sign of it.
const RATES = {
  "claude-opus-5": { input: 5, output: 25, cacheWrite5m: 6.25, cacheWrite1h: 10, cacheRead: 0.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite5m: 1.25, cacheWrite1h: 2, cacheRead: 0.1 },
};

// A web search the model runs server-side is billed per search on top of
// the tokens: $10 per 1,000 searches.
export const WEB_SEARCH_MICROS = 10_000;

// What an unrecognized model is priced as: the most expensive one above.
// Over-counting means a cap trips early; under-counting means it never
// does, and only one of those fails safe.
const FALLBACK_MODEL = "claude-opus-5";

// The API reports the model it served, which can carry a date suffix
// ("claude-haiku-4-5-20251001") that the rate table, like every other
// model id in this app, deliberately doesn't.
export function canonicalModelId(model) {
  return String(model || "").replace(/-\d{8}$/, "");
}

// Keeps one row from overflowing the INTEGER column it's stored in
// (about $2,147) - not a limit anything real reaches, just a guard.
const MAX_ROW_MICROS = 2_000_000_000;

// `usage` is the object on every Messages response. Every field may be
// absent or null (an old response, a call with no caching, no search), and
// each counts as zero.
export function costMicros(model, usage) {
  const id = canonicalModelId(model);
  const known = Object.hasOwn(RATES, id);
  const rate = RATES[known ? id : FALLBACK_MODEL];
  const n = (value) => (Number.isFinite(value) && value > 0 ? value : 0);

  const input = n(usage?.input_tokens);
  const output = n(usage?.output_tokens);
  const cacheRead = n(usage?.cache_read_input_tokens);
  const created = n(usage?.cache_creation_input_tokens);
  // When the API breaks cache writes down by lifetime, price each at its
  // own rate; otherwise every write is the default 5-minute kind.
  const created1h = Math.min(created, n(usage?.cache_creation?.ephemeral_1h_input_tokens));
  const created5m = created - created1h;
  const searches = n(usage?.server_tool_use?.web_search_requests);

  const micros =
    input * rate.input +
    output * rate.output +
    cacheRead * rate.cacheRead +
    created5m * rate.cacheWrite5m +
    created1h * rate.cacheWrite1h +
    searches * WEB_SEARCH_MICROS;

  return { micros: Math.min(Math.round(micros), MAX_ROW_MICROS), assumed: !known };
}
