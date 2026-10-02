// Server-only, asserted at build time rather than by convention. This
// module constructs the Anthropic SDK at import, and the SDK refuses to run
// in a browser - it throws on construction, which takes down whatever page
// imported it. That shipped once: a client component imported a helper that
// imported this file, and the whole Suggest page showed its error boundary
// in production while every local dev check passed. A comment would not
// have caught it; this turns the same mistake into a failed build.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Resolves the API key from the ANTHROPIC_API_KEY environment variable.
export const anthropic = new Anthropic();

// Which model each kind of work runs on lives in lib/ai-models.js, beside
// what happens to it when a Domaine is over its monthly cap. Re-exported
// so the code that already imports these from here keeps working.
export { EXTRACTION_MODEL, REASONING_MODEL } from "@/lib/ai-models";
