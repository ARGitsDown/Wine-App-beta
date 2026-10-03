#!/usr/bin/env node
// Runs the same Suggest request against Opus, Sonnet and Haiku side by
// side, so you can judge for yourself whether each model is earning its
// place on this call - see BACKLOG #23 for the run this script first
// produced and what was decided from it.
//
// The three arms are the three models Suggest can actually run on:
//   opus   - "Master Sommelier" (lib/suggest-depth.js), the reasoning tier
//   sonnet - "Standard", the default, and what "Master Sommelier" drops to
//            when a Domaine is over its monthly cap
//   haiku  - what "Standard" drops to over the cap (lib/usage.js). Its
//            quality here has never been measured - BACKLOG #56 - which is
//            the main reason to run this. It takes no thinking and no
//            effort setting, so it gets none, exactly as in the app.
// Each arm's request fields come from requestShape() in lib/ai-models.js,
// the same function the app uses, so they cannot drift from the real thing.
//
// What this script shares with the app, imported rather than copied: the
// model tiers (lib/ai-models.js), the tool schemas and system prompt
// (lib/suggest-prompt.js), the effort dial (lib/effort.js) and the
// character steer (lib/suggestion-character.js). What it still copies is
// the browse_cellar query below, because the app's version goes through
// Prisma and the session-scoped client, which a plain node script can't
// load; if that changes in app/actions.js, re-sync it by eye. It also does
// not go through ai.call() - there is no session or Domaine here - so
// nothing it does is counted in the usage ledger or held by a cap.
//
// Still worth re-running whenever the system prompt, the tool schemas or
// the models change, since the whole basis of the depth dial and the cap's
// tier-down is a measurement that can go stale.
//
// Usage (reads .env the same way prisma.config.ts does):
//   node scripts/compare-suggest-models.mjs
//   node scripts/compare-suggest-models.mjs --runs 3
//   node scripts/compare-suggest-models.mjs --query "salmon with a citrus glaze" --runs 2
//   node scripts/compare-suggest-models.mjs --models haiku,sonnet
//   node scripts/compare-suggest-models.mjs --json out.json
//
// Needs a real ANTHROPIC_API_KEY in .env (not the stub key used for local
// UI verification) and the same DATABASE_URL the app uses - it reads your
// actual current cellar, the same way a live Suggest request would. It
// spends real money: three models, five queries, two runs each is thirty
// calls.

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";
import { writeFile } from "node:fs/promises";
import { requestShape } from "../lib/ai-models.js";
import { DEFAULT_EFFORT, normalizeEffort } from "../lib/effort.js";
import { BROWSE_CELLAR_TOOL, SUGGESTIONS_TOOL, buildSuggestSystemPrompt } from "../lib/suggest-prompt.js";
import {
  DEFAULT_CHARACTER,
  normalizeCharacter,
} from "../lib/suggestion-character.js";
import { getDatabaseUrl } from "../lib/database-url.js";

// ---------------------------------------------------------------------
// CLI args - deliberately minimal, no dependency for this
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = { queries: [], runs: 2, models: ["sonnet", "opus", "haiku"], json: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--query") args.queries.push(argv[++i]);
    else if (arg === "--runs") args.runs = Number(argv[++i]);
    else if (arg === "--models") args.models = argv[++i].split(",").map((s) => s.trim());
    else if (arg === "--json") args.json = argv[++i];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

// A spread of cases chosen to actually exercise judgment, not just lookup -
// an easy pairing, an ambiguous one, a flight (tests ordering), a request
// where the cellar likely has nothing great (tests whether it says so
// honestly rather than forcing a pick), and a character/request that pull
// in different directions. Edit freely, or pass --query to test one thing
// ad hoc instead of this whole set.
const DEFAULT_QUERIES = [
  {
    label: "Easy pairing",
    request: "Grilled ribeye steak with a peppercorn sauce",
  },
  {
    label: "Ambiguous dish",
    request: "A spicy Thai green curry with chicken",
  },
  {
    label: "Tasting flight (tests ordering)",
    request: "I want to do a flight of three wines exploring what Pinot Noir can taste like from different places",
  },
  {
    label: "Likely nothing owned fits well",
    request: "A delicate, chilled sparkling rosé for a summer afternoon",
  },
  {
    label: "Character pulls against the obvious answer",
    request: "Thanksgiving turkey with all the sides",
    character: "avant-garde",
  },
];

// The same filtering browseCellar() in app/actions.js does, just fed by a
// plain SQL fetch (pg, not Prisma) instead - Prisma's generated client here
// is TypeScript source meant for a bundler, which a plain `node` script
// can't import directly. Filtering in JS, not SQL, on purpose: matching
// app/actions.js's exact semantics (case-insensitive substrings, a bottle
// with no window always passing readyToDrink) mattered more than a leaner
// query.
async function browseCellar(pool, filters) {
  const { rows } = await pool.query(`
    SELECT b.*, tn.rating
    FROM "Bottle" b
    LEFT JOIN "TastingNote" tn ON tn."bottleId" = b.id
    WHERE b.status = 'inventory'
    ORDER BY b.producer ASC
  `);

  const byBottle = new Map();
  for (const row of rows) {
    if (!byBottle.has(row.id)) byBottle.set(row.id, { ...row, ratings: [] });
    if (row.rating !== null) byBottle.get(row.id).ratings.push(row.rating);
  }
  const bottles = [...byBottle.values()].map((bottle) => ({
    ...bottle,
    averageRating: bottle.ratings.length
      ? bottle.ratings.reduce((sum, r) => sum + r, 0) / bottle.ratings.length
      : null,
  }));

  const currentYear = new Date().getFullYear();
  const matches = bottles.filter((bottle) => {
    if (filters.type && !bottle.type?.toLowerCase().includes(filters.type.toLowerCase())) return false;
    if (filters.region && !bottle.region?.toLowerCase().includes(filters.region.toLowerCase())) return false;
    if (filters.country && !bottle.country?.toLowerCase().includes(filters.country.toLowerCase())) return false;
    if (filters.minVintage && (!bottle.vintage || bottle.vintage < filters.minVintage)) return false;
    if (filters.maxVintage && (!bottle.vintage || bottle.vintage > filters.maxVintage)) return false;
    if (filters.readyToDrink) {
      if (bottle.drinkFrom && currentYear < bottle.drinkFrom) return false;
      if (bottle.drinkTo && currentYear > bottle.drinkTo) return false;
    }
    return true;
  });

  const capped = matches.slice(0, 250);
  return {
    totalMatching: matches.length,
    truncated: matches.length > capped.length,
    bottles: capped.map((bottle) =>
      Object.fromEntries(
        Object.entries({
          id: bottle.id,
          producer: bottle.producer,
          bottling: bottle.bottling,
          vintage: bottle.vintage,
          type: bottle.type,
          variety: bottle.variety,
          region: bottle.region,
          country: bottle.country,
          quantity: bottle.quantity,
          averageRating: bottle.averageRating,
          drinkFrom: bottle.drinkFrom,
          drinkTo: bottle.drinkTo,
          drinkWindowEstimated:
            bottle.drinkFrom != null || bottle.drinkTo != null
              ? bottle.drinkWindowEstimated
              : null,
        }).filter(([, value]) => value != null)
      )
    ),
  };
}

function unusableResponseError(response) {
  if (response.stop_reason === "refusal") return "Claude declined the request.";
  if (response.stop_reason === "max_tokens") return "Ran out of room before finishing.";
  return null;
}

// ---------------------------------------------------------------------
// The comparison run itself
// ---------------------------------------------------------------------

// An arm is a tier plus whether it is the over-cap one - what the app asks
// requestShape() for; the model id and its request fields come back.
const ARMS = {
  opus: { tier: "reasoning", lighter: false },
  sonnet: { tier: "extraction", lighter: false },
  haiku: { tier: "extraction", lighter: true },
};

// One full call, exactly what getSuggestions in app/actions.js does,
// parameterized by arm instead of by the owner's dial and the Domaine's
// allowance - the one deliberate difference from the real thing, since
// that's the whole point of this script.
async function runSuggestion({ anthropic, pool, arm, request, character, effort, includeOutside }) {
  const shape = requestShape(arm.tier, { lighter: arm.lighter, effort });
  const steer = normalizeCharacter(character);
  const outside = Boolean(includeOutside);
  const systemPrompt = buildSuggestSystemPrompt(new Date().getFullYear(), outside, steer);
  const messages = [{ role: "user", content: request }];

  const browseTrace = [];
  const usageTotals = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const startedAt = Date.now();

  for (let turn = 0; turn < 6; turn++) {
    const response = await anthropic.messages.create({
      model: shape.model,
      max_tokens: 8192,
      ...shape.params,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      tools: [BROWSE_CELLAR_TOOL, SUGGESTIONS_TOOL],
      messages,
    });

    for (const key of Object.keys(usageTotals)) {
      usageTotals[key] += response.usage?.[key] ?? 0;
    }

    const unusable = unusableResponseError(response);
    if (unusable) return { error: unusable, browseTrace, usageTotals, ms: Date.now() - startedAt, turns: turn + 1 };

    const toolUses = response.content.filter((block) => block.type === "tool_use");
    const finalCall = toolUses.find((t) => t.name === "record_suggestions");
    if (finalCall) {
      const picks = finalCall.input.picks;
      const ownedIds = picks.map((p) => p.bottleId).filter((id) => id !== null);
      let bottleById = new Map();
      if (ownedIds.length) {
        const { rows } = await pool.query(`SELECT id, producer, bottling, vintage, type FROM "Bottle" WHERE id = ANY($1)`, [ownedIds]);
        bottleById = new Map(rows.map((b) => [b.id, b]));
      }
      const resolvedPicks = picks.map((pick) => {
        const bottle = pick.bottleId !== null ? bottleById.get(pick.bottleId) ?? null : null;
        return { ...pick, resolvedBottle: bottle };
      });

      return {
        data: { mode: finalCall.input.mode, title: finalCall.input.title, summary: finalCall.input.summary, picks: resolvedPicks },
        browseTrace,
        usageTotals,
        ms: Date.now() - startedAt,
        turns: turn + 1,
      };
    }

    const browseCalls = toolUses.filter((t) => t.name === "browse_cellar");
    if (browseCalls.length === 0) {
      return { error: "No tool call at all.", browseTrace, usageTotals, ms: Date.now() - startedAt, turns: turn + 1 };
    }

    const toolResults = await Promise.all(
      browseCalls.map(async (call) => {
        const result = await browseCellar(pool, call.input);
        browseTrace.push({ filters: call.input, totalMatching: result.totalMatching, truncated: result.truncated });
        return { type: "tool_result", tool_use_id: call.id, content: JSON.stringify(result) };
      })
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }

  return { error: "Hit the 6-turn cap without a final answer.", browseTrace, usageTotals, ms: Date.now() - startedAt, turns: 6 };
}

function pickSummary(pick) {
  const wine = pick.resolvedBottle
    ? [pick.resolvedBottle.producer, pick.resolvedBottle.bottling ? `"${pick.resolvedBottle.bottling}"` : null, pick.resolvedBottle.vintage]
        .filter(Boolean)
        .join(" ")
    : `[gap] ${[pick.gapProducer, pick.gapType].filter(Boolean).join(" — ")}`;
  const dish = pick.pairingContext ? ` (${pick.pairingContext})` : "";
  return `    - ${wine}${dish}\n      ${pick.reason}`;
}

function printResult(label, result) {
  console.log(`\n  [${label}] ${result.ms}ms, ${result.turns} turn(s), ${result.browseTrace.length} browse_cellar call(s)`);
  if (result.browseTrace.length) {
    for (const call of result.browseTrace) {
      const filters = Object.entries(call.filters).filter(([, v]) => v !== null).map(([k, v]) => `${k}=${v}`).join(" ") || "(no filters)";
      console.log(`      browse: ${filters} -> ${call.totalMatching} matched${call.truncated ? " (truncated)" : ""}`);
    }
  }
  console.log(`      tokens: in=${result.usageTotals.input_tokens} out=${result.usageTotals.output_tokens} cache_read=${result.usageTotals.cache_read_input_tokens} cache_write=${result.usageTotals.cache_creation_input_tokens}`);
  if (result.error) {
    console.log(`      ERROR: ${result.error}`);
    return;
  }
  console.log(`      "${result.data.title}"`);
  console.log(`      ${result.data.summary}`);
  for (const pick of result.data.picks) console.log(pickSummary(pick));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Usage: node scripts/compare-suggest-models.mjs [options]

  --query "text"     A request to test (repeatable). Defaults to a built-in
                     spread of ${DEFAULT_QUERIES.length} cases if omitted.
  --runs N           Runs per model per query (default 2) - one run each
                     tells you which model answered, not whether either
                     answer is any good; the model doesn't repeat itself
                     exactly even on the same input.
  --models a,b       Which models to test, any of opus, sonnet, haiku
                     (default: all three).
  --json <path>      Also write the full set of results as JSON to this path.
`);
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes("stub")) {
    console.error("ANTHROPIC_API_KEY isn't set to a real key (found a missing or stub value).");
    console.error("Add it to .env - see .env.example.");
    process.exit(1);
  }
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.error("No DATABASE_URL (or its Vercel-integration variants) found in the environment.");
    process.exit(1);
  }

  const anthropic = new Anthropic();
  const pool = new pg.Pool({ connectionString: databaseUrl });

  const queries = args.queries.length
    ? args.queries.map((request) => ({ label: request, request }))
    : DEFAULT_QUERIES;

  const allResults = [];

  for (const query of queries) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`QUERY: ${query.label}`);
    console.log(`  "${query.request}"${query.character ? ` (character: ${query.character})` : ""}`);
    console.log("=".repeat(70));

    for (const modelKey of args.models) {
      const arm = ARMS[modelKey];
      if (!arm) {
        console.error(`Unknown model "${modelKey}" - use opus, sonnet or haiku.`);
        continue;
      }
      console.log(`\n${modelKey.toUpperCase()} (${requestShape(arm.tier, { lighter: arm.lighter }).model}):`);
      for (let run = 1; run <= args.runs; run++) {
        try {
          const result = await runSuggestion({
            anthropic,
            pool,
            arm,
            request: query.request,
            character: query.character ?? DEFAULT_CHARACTER,
            effort: normalizeEffort(query.effort ?? DEFAULT_EFFORT),
            includeOutside: query.includeOutside ?? false,
          });
          printResult(`run ${run}/${args.runs}`, result);
          allResults.push({ query: query.label, model: modelKey, run, ...result });
        } catch (err) {
          console.log(`\n  [run ${run}/${args.runs}] THREW: ${err.message}`);
          allResults.push({ query: query.label, model: modelKey, run, error: err.message });
        }
      }
    }
  }

  await pool.end();

  if (args.json) {
    await writeFile(args.json, JSON.stringify(allResults, null, 2));
    console.log(`\nFull results written to ${args.json}`);
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("Done. Read the picks and reasoning above for quality - this script");
  console.log("only measures what's mechanical (latency, browse calls, tokens).");
  console.log("=".repeat(70));
}

// Only run when executed directly (`node compare-suggest-models.mjs`), not
// when another script imports browseCellar() or runSuggestion() from this
// file for its own purposes.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
