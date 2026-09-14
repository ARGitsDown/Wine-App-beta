import Anthropic from "@anthropic-ai/sdk";

// Resolves the API key from the ANTHROPIC_API_KEY environment variable.
export const anthropic = new Anthropic();

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
