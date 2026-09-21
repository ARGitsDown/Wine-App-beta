// How much reasoning power a Suggest request gets - which model answers it,
// not how long one model thinks about it.
//
// No imports, and that is a rule rather than a coincidence. This module is
// read by SuggestForm, a client component, so anything it pulls in is
// shipped to the browser and evaluated there. The mapping from a depth to
// an actual model id therefore lives in lib/suggest-model.js, which is
// server-only: the Anthropic SDK throws outright in a browser ("It looks
// like you're running in a browser-like environment"), and when this file
// imported the model ids directly it took the whole SDK into the client
// bundle with them and broke the entire Suggest page in production. The
// effort dial this replaced had no imports either, which is exactly why
// that failure mode had never come up before.
//
// This replaced an effort dial (lib/effort.js, still in use on Research)
// because the two were competing to express the same intent, and only one
// of them had ever been measured. Five queries against a real cellar on
// 2026-09-21, recorded in full in BACKLOG #23:
//
//   Sonnet 5   $0.0315/query   23.7s avg   2-3 turns
//   Opus 5     $0.1911/query   44.4s avg   3-5 turns
//
// Opus costs 6.1x and takes 1.9x as long, and what that buys depends
// entirely on the question. On a direct "this dish, what wine" pairing the
// two led with the same bottle for the same reason every time, and Opus's
// advantage was breadth - a third option, and better use of the cellar's
// own data ("you have two bottles of it, so it's easier to justify on a
// weeknight"). On open-ended requests the gap was real: asked for a
// Thanksgiving table with an avant-garde steer, Sonnet proposed a sound
// orange-wine centrepiece; Opus proposed four wines across the meal, named
// the social risk of each unconventional choice, and noticed that one
// bottle's drinking window closes in 2026 so these were the last of them.
//
// Sonnet was never wrong. Every pick it made was defensible and factually
// sound. So the honest shape of this control is not "good and better" but
// "enough, and more when the question deserves it" - which is why the
// cheaper rung is the default and carries the unglamorous name.
export const DEPTH_LEVELS = [
  {
    value: "standard",
    label: "Standard",
    hint: "Answers in about half the time. Plenty for a dish and a bottle to go with it.",
  },
  {
    value: "sommelier",
    label: "Master Sommelier",
    // The wait is the thing to say out loud. It is the cost the owner
    // actually feels standing in the kitchen - the money is pennies either
    // way - and a control that quietly doubles a 40-second wait without
    // warning is one you learn to distrust.
    hint: "Reads the whole cellar and argues its case. Takes noticeably longer — worth it for a menu, a flight, or an unusual request.",
  },
];

// Sonnet, deliberately. Most requests to this feature are a dish and a
// question, which is the case where the measurements found no difference
// worth six times the cost and twice the wait. Escalating is one tap, and
// the expensive answer is better spent on the requests that earn it.
export const DEFAULT_DEPTH = "standard";

// The value crosses from a browser form into an API request, where an
// unrecognized model is a 400 rather than a shrug - and it also comes back
// out of a saved pairing written under an older vocabulary. Anything
// unrecognized becomes the default, the same fallback normalizeEffort and
// normalizeCharacter use, rather than a guess at what was meant.
export function normalizeDepth(value) {
  return DEPTH_LEVELS.some((level) => level.value === value) ? value : DEFAULT_DEPTH;
}
