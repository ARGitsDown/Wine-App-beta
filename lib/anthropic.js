import Anthropic from "@anthropic-ai/sdk";

// Resolves the API key from the ANTHROPIC_API_KEY environment variable.
export const anthropic = new Anthropic();
