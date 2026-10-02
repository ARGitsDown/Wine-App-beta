import { outputConfig } from "./effort.js";

// Which model each kind of work runs on, and how that changes when a
// Domaine is over its monthly cap (lib/usage.js). Pure strings and
// objects with no SDK import - lib/anthropic.js re-exports the constants
// below for the code that already imports them there.
//
// The app's AI calls split into two kinds of work, and the split is worth
// keeping deliberate: a heavier model is slower on every call, so it should
// only be doing work that actually needs it.
//
// EXTRACTION covers reading a label into known fields, estimating a
// drinking window, and synthesizing search results someone else already
// found - structured output against a schema, where the hard part is
// reading carefully rather than deciding well.
//
// REASONING covers open-ended judgment with no schema to lean on: weighing
// a whole cellar against a menu, ordering a flight, deciding that nothing
// owned actually fits. That's where the heavier model earns its latency.
export const EXTRACTION_MODEL = "claude-sonnet-5";
export const REASONING_MODEL = "claude-opus-5";

// What a Domaine over its cap drops to - never off. The cap's contract is
// that every feature keeps working, one tier down: reasoning work runs on
// the extraction model, and extraction work on this.
export const LIGHTER_MODEL = "claude-haiku-4-5";

const NORMAL = { reasoning: REASONING_MODEL, extraction: EXTRACTION_MODEL };
const ONE_DOWN = { reasoning: EXTRACTION_MODEL, extraction: LIGHTER_MODEL };

// Research's web search comes in versions, and the newer one isn't
// available on Haiku 4.5, which only takes the basic tool. Sending the
// newer type to it fails the request outright instead of getting cheaper,
// so the tool version has to follow the model down.
const WEB_SEARCH_NEW = "web_search_20260318";
const WEB_SEARCH_BASIC = "web_search_20250305";

// Everything about a request that depends on the model, for one call:
//   model         - the id to send
//   params        - the model-dependent request fields to spread in
//   webSearchType - the web_search tool version this model accepts
//   lighter       - true when this is the over-cap tier
//
// Haiku 4.5 predates adaptive thinking and the `effort` setting: it takes
// neither (an effort level errors on it, and thinking there means a fixed
// token budget this app never configured), so its params are empty and it
// simply answers without extended thinking. Every model above it takes
// both, so the other tiers send exactly what each call has always sent.
export function requestShape(tier, { lighter = false, effort } = {}) {
  const model = (lighter ? ONE_DOWN : NORMAL)[tier];
  if (!model) throw new Error(`Unknown AI tier: ${tier}`);

  const takesThinking = model !== LIGHTER_MODEL;
  return {
    model,
    lighter,
    params: takesThinking
      ? { thinking: { type: "adaptive" }, output_config: outputConfig(effort) }
      : {},
    webSearchType: takesThinking ? WEB_SEARCH_NEW : WEB_SEARCH_BASIC,
  };
}
