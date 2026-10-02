import "server-only";
import { normalizeDepth } from "@/lib/suggest-depth";

// Which kind of work each rung of the Suggest depth dial is - and through
// that, which model it runs on.
//
// Split from lib/suggest-depth.js, which the form imports, because that
// makes this file reachable from the browser the moment the two are joined
// - and the Anthropic SDK does not merely fail in a browser, it throws on
// construction and takes the whole page down with it. That is not a
// hypothetical: it shipped, and the entire Suggest page showed the error
// boundary in production until this split.
//
// `server-only` at the top is the part that stops it happening again. It is
// a build-time assertion rather than a comment: any client component that
// ends up importing this, however many modules deep, fails the build with a
// pointed message instead of rendering an error boundary to whoever opens
// the page.
//
// Returns a tier, not a model id, since the model now also depends on the
// Domaine's monthly allowance: a "sommelier" request is "reasoning" work
// (Opus) normally and runs one tier down (Sonnet) once the Domaine is over
// its cap. lib/ai-models.js owns that mapping; lib/usage.js applies it.
const TIER_FOR_DEPTH = {
  standard: "extraction",
  sommelier: "reasoning",
};

export function depthTier(depth) {
  return TIER_FOR_DEPTH[normalizeDepth(depth)];
}
