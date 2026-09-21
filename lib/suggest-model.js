import "server-only";
import { EXTRACTION_MODEL, REASONING_MODEL } from "@/lib/anthropic";
import { normalizeDepth } from "@/lib/suggest-depth";

// Which model each rung of the Suggest depth dial actually runs on.
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
const MODEL_FOR_DEPTH = {
  standard: EXTRACTION_MODEL,
  sommelier: REASONING_MODEL,
};

// A helper rather than a lookup at the call site, so that the day a depth
// wants its own output_config or task budget alongside the model, there is
// one place to put it.
export function depthConfig(depth) {
  return { model: MODEL_FOR_DEPTH[normalizeDepth(depth)] };
}
