// How hard Claude works on a single request.
//
// Effort is a dial on one model rather than a choice between models, and
// that distinction is the whole reason this file exists instead of a
// second model constant. Prompt caches are keyed per model, and two of
// this app's prompts are cached (the scan prefix and the Suggest prefix),
// so routing some calls to a cheaper model would forfeit the cache hit
// and eat most of the per-token saving. Turning the same model down costs
// nothing but thoroughness.
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
