import { characterRule } from "./suggestion-character.js";

// What Suggest sends Claude: the two tools and the system prompt. Kept out
// of app/actions.js - a "use server" file, where every export has to be a
// Server Action - so that scripts/compare-suggest-models.mjs imports the
// real thing instead of keeping a hand-copied twin that drifts (it did, and
// stopped matching the prompt it was supposed to be measuring). No SDK, no
// database, no "@/" alias: plain node can load this file as it is.
//
// Only getSuggestions in app/actions.js uses these in the app. The one
// piece still duplicated is the browse_cellar *query* (Prisma there, plain
// pg in the script), since that can't be shared the same way.

export const BROWSE_CELLAR_TOOL = {
  name: "browse_cellar",
  description:
    "Browse this user's current inventory - bottles they actually own and could open tonight, not their wishlist or already-consumed bottles - to find candidates for a pairing or tasting recommendation. One call with no filters returns the whole cellar, and that is normally what you want: a personal cellar fits comfortably in a single response, and reasoning across all of it at once is both better and cheaper than guessing which filters to try. Filters are for narrowing a cellar you have already seen, not for discovering what is in it - reach for a second call when you want one specific slice, not as a way of exploring. Returns `bottles` (at most 250, ordered by producer name), `totalMatching` (how many bottles actually matched your filters), and `truncated`. Each bottle carries its id (needed to reference it in your final answer), its producer, and whichever of bottling, vintage, type, variety, region, country, quantity, averageRating (the owner's own average score), drinkFrom/drinkTo (its drinking window) and drinkWindowEstimated are actually recorded. A field that is absent is simply not on file - for a drinking window that means no window has been recorded, NOT that the wine is unready. drinkWindowEstimated is true when the window is the app's own guess rather than something read from a source or typed by the owner. When `truncated` is true you are looking at an alphabetical slice rather than the cellar - narrow the filters and call again rather than choosing from what came back.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: ["string", "null"],
        description: "Filter by the bottle's short type/style label, substring match (e.g. 'Pinot Noir', 'Sauvignon Blanc'). Null for no filter.",
      },
      region: {
        type: ["string", "null"],
        description: "Filter by region, substring match (e.g. 'Bordeaux', 'Oregon'). Null for no filter.",
      },
      country: {
        type: ["string", "null"],
        description: "Filter by country, substring match. Null for no filter.",
      },
      minVintage: {
        type: ["integer", "null"],
        description: "Only bottles from this vintage or later. Null for no minimum.",
      },
      maxVintage: {
        type: ["integer", "null"],
        description: "Only bottles from this vintage or earlier. Null for no maximum.",
      },
      readyToDrink: {
        type: ["boolean", "null"],
        description:
          "True to only return bottles whose drinking window (if any is set) includes the current year - i.e. not too young and not past peak. Bottles with no drinking window set are always included, since most wines don't have one recorded. Null for no filter (browse everything regardless of window).",
      },
    },
    required: ["type", "region", "country", "minVintage", "maxVintage", "readyToDrink"],
    additionalProperties: false,
  },
  strict: true,
};

export const SUGGESTION_PICK_SCHEMA = {
  type: "object",
  properties: {
    bottleId: {
      type: ["integer", "null"],
      description:
        "The id of an existing inventory bottle returned by browse_cellar, if recommending something the user already owns. Null if this is a gap suggestion - something not currently owned that would be worth adding to the wishlist instead. Never null for a wine browse_cellar returned: if it is in the cellar, give its id.",
    },
    pairingContext: {
      type: ["string", "null"],
      description:
        "For a pairing with more than one dish or course: the dish this wine is for, as a short label in sentence case with no leading 'the' (e.g. 'Grilled salmon', 'Cheese course'). Every wine for the same dish must use exactly the same label, character for character - the app groups wines under it as a heading. Null on every pick for a single-dish request and for a tasting flight; never set it on some picks and leave it null on others.",
    },
    reason: {
      type: "string",
      description:
        "Why this wine for this dish (or its place in the flight), in one or two plain sentences. It is shown in full on the wine's card and is what the owner decides on, so it must stand on its own; don't restate the wine's name or the dish, which are shown above it. When a dish has more than one wine, say what this one does that the others don't. Plain text only - no markdown, lists or line breaks. If you mention a drinking window whose drinkWindowEstimated is true, say it is an estimate (\"estimated to be drinking now\", \"roughly 2024-2028\") - never present it as established.",
    },
    gapProducer: {
      type: ["string", "null"],
      description:
        "For a gap suggestion (bottleId null) only: a real, specific example producer for the style being suggested - not a vague placeholder. Null when bottleId is set.",
    },
    gapType: {
      type: ["string", "null"],
      description:
        "For a gap suggestion only: a short style/variety label, matching the app's `type` field convention (e.g. 'Sancerre', 'Riesling'). Null when bottleId is set.",
    },
    gapRegion: {
      type: ["string", "null"],
      description: "For a gap suggestion only. Null when bottleId is set.",
    },
    gapCountry: {
      type: ["string", "null"],
      description: "For a gap suggestion only. Null when bottleId is set.",
    },
  },
  required: [
    "bottleId",
    "pairingContext",
    "reason",
    "gapProducer",
    "gapType",
    "gapRegion",
    "gapCountry",
  ],
  additionalProperties: false,
};

export const SUGGESTIONS_TOOL = {
  name: "record_suggestions",
  description:
    "Record your final wine recommendations, after browsing the cellar as needed. For a tasting flight, list picks in suggested tasting order.",
  input_schema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["pairing", "tasting"],
        description: "Which kind of request this was.",
      },
      title: {
        type: "string",
        description:
          "A short evocative name for this recommendation - a few words, the way a flight is named on a tasting menu ('The Many Faces of Pinot', 'Chalk and Sea Air', 'Three Ways with the Lamb'). Title Case, no trailing punctuation, and specific to these actual wines rather than a generic label like 'Tasting Flight' or 'Pairing Suggestions'. This is the heading on its own - do not restate the explanation here, that is what summary is for.",
      },
      summary: {
        type: "string",
        description:
          "The explanation behind the title: what the theme is, why these wines, and for a flight why they are in this order. Two to four sentences - this sits behind a 'Why these' disclosure, so it has room to be more than a caption. If you mention a drinking window whose drinkWindowEstimated is true, say it is an estimate (\"estimated to be drinking now\", \"roughly 2024-2028\") - never present it as established.",
      },
      picks: {
        type: "array",
        description: "One entry per recommended wine.",
        items: SUGGESTION_PICK_SCHEMA,
      },
    },
    required: ["mode", "title", "summary", "picks"],
    additionalProperties: false,
  },
  strict: true,
};

export function buildSuggestSystemPrompt(currentYear, includeOutside, character) {
  // The cellar is always the default source. The difference is whether a
  // wine they don't own may be recommended on its merits, or only as an
  // admission that nothing owned fits.
  const outsideRule = includeOutside
    ? "They have asked to see wines beyond their own cellar for this request, so you may recommend wines they do not own wherever one would genuinely pair or fit better - not only as a fallback. Still prefer an owned bottle when it is a comparable match, since that is one they can open tonight; a wine they would have to go and buy has to earn its place by being clearly better for this. Record any such wine as a gap suggestion (bottleId null) with a real, specific producer, and say in its reason what it does that the owned options do not."
    : "Recommend only wines from their cellar. If nothing currently owned is a strong match, say so honestly and propose a specific gap suggestion (a real producer/style/region, not a vague category) worth adding to their wishlist, rather than forcing a mediocre owned bottle into the recommendation.";

  // Deliberately after outsideRule: how adventurous to be is a question
  // asked of whatever sources that rule has already allowed, and the
  // steer's own wording refers back to it. Empty - with no stray spacing -
  // when the character is Balanced, so an unsteered prompt is byte-for-byte
  // what it was before this control existed.
  const steer = characterRule(character);
  const steerRule = steer ? `${steer} ` : "";

  return `You help a home wine collector decide what to open, in one of two ways: PAIRING (they describe a meal or dish, possibly with multiple courses - recommend one or more wines from their own cellar for it) or TASTING (they describe a theme, goal, or mood - build an ordered flight of wines from their cellar exploring it). Infer which one from their request. For a pairing, think in courses: give each dish one wine, or two or three when there is a real choice between them - never more than three for one dish - and list a dish's wines together. A gap suggestion must be a wine that browse_cellar did not return; if it is in their cellar, recommend that bottle by its id instead. Call browse_cellar with no filters first to see their whole current inventory - one call normally returns all of it - and choose only from real bottles in what comes back; never invent a bottle they don't have, and never assume what's there without browsing. A browse_cellar result with truncated true is a partial view - the first matches by producer name, not the best ones - so narrow the filters and browse again before deciding, and never call a pick the best in their cellar on the strength of a truncated browse. The current year is ${currentYear} - browse_cellar returns each bottle's drinkFrom/drinkTo drinking window where one is recorded (null means none is recorded, not that it's unready). Prefer a bottle whose window (if any) includes ${currentYear}; avoid one that's too young (${currentYear} < drinkFrom) or past peak (${currentYear} > drinkTo) unless nothing better fits, in which case say so plainly in your reasoning for that pick rather than silently ignoring it. Each window also carries drinkWindowEstimated: true means the years are the app's own guess rather than anything anyone looked up, so treat them as approximate and don't claim where they came from; false means they were read from a source or entered by the owner. The flag only means anything when drinkFrom or drinkTo is actually set - for a bottle with no window at all, ignore it. Choose between bottles using an estimated window exactly as you would a sourced one, but never quote an estimated one back as established fact - write "estimated to be drinking now" or "roughly 2024-2028", not "drinking right in its window (2024-2028)". Every other screen marks an estimate as an estimate, and a recommendation that quietly promotes a guess to a fact is the one way this feature misleads. ${outsideRule} ${steerRule}For a tasting flight, order picks in the sequence they should be tasted (typically lightest/driest to fullest/sweetest, or whatever logic fits the theme) and explain that ordering in the summary. Every answer needs both a title and a summary, and they do different jobs: the title is a short evocative name shown as the heading and saved as the flight's name, the summary is the fuller explanation shown behind it. Don't let the title swell into a sentence, and don't let the summary open by restating the title. Call record_suggestions exactly once, when you're done, with your final answer.`;
}
