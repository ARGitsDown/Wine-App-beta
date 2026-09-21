// How hard Claude works on a single request.
//
// Effort is a dial on one model rather than a choice between models. That
// distinction used to be an argument for this file over a model constant,
// on the grounds that prompt caches are keyed per model, so routing calls
// to a cheaper one would forfeit the cache hit and eat most of the saving.
//
// Measured 2026-09-21, that argument does not survive contact with the
// numbers. Switching model costs one cache write the first time each model
// is used - $0.019 on Opus, $0.008 on Sonnet, against Suggest query costs
// of $0.03 to $0.19 - while the model choice itself moved cost by 6.1x.
// Real, and an order of magnitude too small to decide anything. Suggest's
// dial is a model choice now (lib/suggest-depth.js); this one survives
// where it genuinely is about thoroughness on a fixed model, which is
// Research and the mechanical calls below.
//
// Lives here rather than in app/actions.js because that file is a
// "use server" module, where every export has to be an async Server
// Action.

// What every call in this app has always done. `output_config` was never
// set anywhere, and the API's own default is "high" - so this constant
// does not change a single request's behaviour, it just says out loud
// what was being chosen by omission.
//
// Deliberately not lowered on the mechanical calls (drinking windows,
// reading a label, reading a photo) even though those are the textbook
// candidates for it. Stepping one of them down trades accuracy for speed
// on the owner's behalf, and the honest way to make that trade is to
// measure it first - see BACKLOG #23.
//
// One call site has now been measured and lowered on the strength of it:
// bulk research runs at "low" (BULK_RESEARCH_EFFORT in app/actions.js),
// where "high" was taking 60-160s against a 60s function ceiling and so
// was not merely expensive but broken. The remaining mechanical calls are
// still untested and still default; that entry has the numbers and the
// method for anyone repeating it.
export const DEFAULT_EFFORT = "high";

// Three of the API's five levels. `medium` is left out because the useful
// question here is "faster, same, or more careful" and a fourth option
// makes that harder to answer, not easier; `max` is left out because
// nothing in a wine recommendation has a correctness bar that justifies
// its cost - "thorough" tops out at xhigh, which is the setting the
// guidance recommends for genuinely hard work.
//
// The middle option is the status quo: exactly what every call did before
// this control existed, so neither of the others is a silent change to
// it. It is called Standard rather than Balanced because Suggest's
// Character control, which sits directly above this one on the same
// screen, already has a Balanced - two of them stacked read as one
// setting shown twice.
export const EFFORT_LEVELS = [
  {
    value: "low",
    label: "Quick",
    hint: "Answers sooner and costs less. Best when you roughly know what you want.",
  },
  {
    value: "high",
    label: "Standard",
    hint: "The default — thinks it through without labouring the point.",
  },
  {
    value: "xhigh",
    label: "Thorough",
    hint: "Takes longer and costs more. Worth it for a hard request or an obscure bottle.",
  },
];

// The value crosses from a browser form into an API request, where an
// unrecognized level is a 400 rather than a shrug. Anything not on the
// list above becomes the default, which is the same fallback
// characterRule uses for an unknown steer: no guess at which one was
// meant.
export function normalizeEffort(value) {
  return EFFORT_LEVELS.some((level) => level.value === value)
    ? value
    : DEFAULT_EFFORT;
}

// What goes into a request. A helper rather than an inline object literal
// at seven call sites, so that the day this app wants a task budget or a
// different output_config field, there is one place to add it.
export function outputConfig(effort = DEFAULT_EFFORT) {
  return { effort: normalizeEffort(effort) };
}
