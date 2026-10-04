#!/usr/bin/env node
// Step one of any real-model testing: does the API key work at all? One
// Haiku call, 8 output tokens, a fraction of a cent. Prints only whether it
// worked and the token counts - never the key, not even part of it.
//
// Usage:  npm run check-key
// Reads ANTHROPIC_API_KEY from the environment or from .env (gitignored).
// Nothing else in the repo should be run against the API until this prints OK.

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { LIGHTER_MODEL } from "../lib/ai-models.js";

const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error("FAIL: ANTHROPIC_API_KEY is not set (not in the environment, not in .env).");
  console.error("Nothing was sent to the API.");
  process.exit(1);
}
if (key === "smoke-test-placeholder" || key.includes("placeholder") || key.length < 20) {
  console.error("FAIL: ANTHROPIC_API_KEY looks like a placeholder, not a real key.");
  console.error("Nothing was sent to the API.");
  process.exit(1);
}

try {
  const client = new Anthropic({ apiKey: key });
  const message = await client.messages.create({
    model: LIGHTER_MODEL,
    max_tokens: 8,
    messages: [{ role: "user", content: "Reply with the single word: ok" }],
  });
  const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("").trim();
  console.log(`OK: ${message.model} answered "${text}" (${message.usage.input_tokens} in, ${message.usage.output_tokens} out).`);
} catch (err) {
  // The status and the API's own error type are enough to act on; the request
  // (which carries the key in a header) is deliberately not printed.
  console.error(`FAIL: the API answered ${err?.status ?? "with no status"}: ${err?.error?.error?.type ?? err?.name ?? "unknown error"}.`);
  console.error(err?.error?.error?.message ?? err?.message ?? "");
  process.exit(1);
}
