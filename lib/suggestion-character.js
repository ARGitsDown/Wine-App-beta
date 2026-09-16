// How adventurous a Suggest recommendation should be. This is a claim
// about the *choice*, not about the wine's style: "avant-garde" means an
// unexpected pick, not a natural/orange/low-intervention one.
//
// Lives here rather than in app/actions.js because that file is a
// "use server" module, and those can only export async functions.

// The absence of a steer, given a visible name. Balanced adds no clause
// to the prompt at all - the model is simply left to judge, which is what
// it did before this control existed - so picking it is the same answer
// as never touching the control, and the label just makes that state
// legible instead of implicit.
export const DEFAULT_CHARACTER = "balanced";

// A shared tail for every explicit steer. Two failure modes it heads off:
// treating the steer as permission to ignore the cellar-only setting, and
// treating it as outranking what the person actually asked for.
const STEER_TAIL =
  " Work within whatever sources are allowed above: if they have asked for their own cellar only and it is a conservative one, find the most fitting option it actually contains rather than abandoning that constraint or apologizing for their cellar. If their own request already says how adventurous they want to be, their words win over this setting.";

export const SUGGESTION_CHARACTERS = [
  {
    value: "balanced",
    label: "Balanced",
    hint: "A sound recommendation, adventurous only where that genuinely serves the request.",
    rule: "",
  },
  {
    value: "classic",
    label: "Classic",
    hint: "The benchmark match — what a sommelier would reach for first.",
    rule:
      "Lean classic: prefer the benchmark answer - the pairing or progression that is canonical for a reason, the bottle a sommelier would reach for first. Where two options are close, take the more established one.",
  },
  {
    value: "exploratory",
    label: "Exploratory",
    hint: "A less obvious choice that still clearly works.",
    rule:
      "Lean exploratory: prefer a less obvious choice that still clearly works - an unexpected grape, region, or producer ahead of the textbook answer, provided it genuinely fits rather than merely being unusual.",
  },
  {
    value: "avant-garde",
    label: "Avant-garde",
    hint: "The boldest pick you can still defend — a claim about the choice, not the wine's style.",
    rule:
      "Lean avant-garde: prefer the boldest choice you can still defend - a genuinely surprising pairing, or an unorthodox progression. This is about how adventurous the choice is, not about the style of wine: an impeccably traditional bottle used in an unexpected role counts, and a natural or orange wine picked because it is the obvious match does not. Say in each reason what the risk is and why it pays off.",
  },
];

// A stored pairing's character is read back into the form and from there
// into a prompt, and the value reaches the server from a browser, so it
// gets the same treatment normalizeEffort gives its own: anything off the
// list becomes the default rather than a guess at what was meant.
export function normalizeCharacter(value) {
  return SUGGESTION_CHARACTERS.some((entry) => entry.value === value)
    ? value
    : DEFAULT_CHARACTER;
}

// The clause to splice into the system prompt. Empty for balanced and for
// anything unrecognized - an unknown value falls back to no steer rather
// than to a guess at which one was meant.
export function characterRule(value) {
  const character = SUGGESTION_CHARACTERS.find((entry) => entry.value === value);
  if (!character || !character.rule) return "";

  // Stated as changing the picks, not the prose: steering toward
  // exploratory should surface a different bottle, not the same bottle
  // with a more adventurous write-up.
  return `${character.rule} This should decide which wines you pick, not only how you describe them.${STEER_TAIL}`;
}
