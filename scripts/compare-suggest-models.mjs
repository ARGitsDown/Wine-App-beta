#!/usr/bin/env node
// Runs the same Suggest request against Opus and Sonnet side by side, so
// you can judge for yourself whether the heavier model is earning its cost
// on this call - see BACKLOG #23 for the run this script produced and what
// was decided from it.
//
// That decision has since landed: Suggest no longer picks a model for you.
// The owner's dial chooses one (lib/suggest-depth.js - "Standard" is
// Sonnet and the default, "Master Sommelier" is Opus), so this script now
// measures the two rungs of a live control rather than arguing about a
// hardcoded choice. Still worth re-running whenever the system prompt, the
// tool schemas or the models themselves change, since the whole basis of
// that control is a measurement that can go stale.
//
// This is a standalone script, not part of the running app, because
// getSuggestions lives in app/actions.js - a "use server" file, where every
// export has to be an async Server Action callable from the browser, not a
// plain function this script could import and call directly with a chosen
// model. So the tool schemas, the system prompt, and the browse/record loop
// below are copied from getSuggestions as it stands today. If that function
// changes, re-sync this file by eye - there is no automated link between
// them, deliberately: importing app/actions.js here would drag in every
// other Server Action and Next's own module resolution, for one function.
//
// What IS imported for real, not copied: the model ids (lib/anthropic.js),
// the effort dial (lib/effort.js) and the character steer
// (lib/suggestion-character.js) - none of those files have the "use server"
// restriction, so there is no reason to fork them.
//
// Usage (reads .env the same way prisma.config.ts does):
//   node scripts/compare-suggest-models.mjs
//   node scripts/compare-suggest-models.mjs --runs 3
//   node scripts/compare-suggest-models.mjs --query "salmon with a citrus glaze" --runs 2
//   node scripts/compare-suggest-models.mjs --models opus
//   node scripts/compare-suggest-models.mjs --json out.json
//
// Needs a real ANTHROPIC_API_KEY in .env (not the stub key used for local
// UI verification) and the same DATABASE_URL the app uses - it reads your
// actual current cellar, the same way a live Suggest request would.

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";
import { writeFile } from "node:fs/promises";
import { EXTRACTION_MODEL, REASONING_MODEL } from "../lib/anthropic.js";
import { DEFAULT_EFFORT, normalizeEffort, outputConfig } from "../lib/effort.js";
import {
  DEFAULT_CHARACTER,
  normalizeCharacter,
  characterRule,
} from "../lib/suggestion-character.js";
import { getDatabaseUrl } from "../lib/database-url.js";

// ---------------------------------------------------------------------
// CLI args - deliberately minimal, no dependency for this
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = { queries: [], runs: 2, models: ["sonnet", "opus"], json: null };
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

// ---------------------------------------------------------------------
// Copied from app/actions.js (see header comment) - keep these three
// blocks and buildSuggestSystemPrompt/browseCellar below in sync by hand.
// ---------------------------------------------------------------------

const BROWSE_CELLAR_TOOL = {
  name: "browse_cellar",
  description:
    "Browse this user's current inventory - bottles they actually own and could open tonight, not their wishlist or already-consumed bottles - to find candidates for a pairing or tasting recommendation. One call with no filters returns the whole cellar, and that is normally what you want: a personal cellar fits comfortably in a single response, and reasoning across all of it at once is both better and cheaper than guessing which filters to try. Filters are for narrowing a cellar you have already seen, not for discovering what is in it - reach for a second call when you want one specific slice, not as a way of exploring. Returns `bottles` (at most 250, ordered by producer name), `totalMatching` (how many bottles actually matched your filters), and `truncated`. Each bottle carries its id (needed to reference it in your final answer), its producer, and whichever of bottling, vintage, type, variety, region, country, quantity, averageRating (the owner's own average score), drinkFrom/drinkTo (its drinking window) and drinkWindowEstimated are actually recorded. A field that is absent is simply not on file - for a drinking window that means no window has been recorded, NOT that the wine is unready. drinkWindowEstimated is true when the window is the app's own guess rather than something read from a source or typed by the owner. When `truncated` is true you are looking at an alphabetical slice rather than the cellar - narrow the filters and call again rather than choosing from what came back.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: ["string", "null"], description: "Filter by the bottle's short type/style label, substring match (e.g. 'Pinot Noir', 'Sauvignon Blanc'). Null for no filter." },
      region: { type: ["string", "null"], description: "Filter by region, substring match (e.g. 'Bordeaux', 'Oregon'). Null for no filter." },
      country: { type: ["string", "null"], description: "Filter by country, substring match. Null for no filter." },
      minVintage: { type: ["integer", "null"], description: "Only bottles from this vintage or later. Null for no minimum." },
      maxVintage: { type: ["integer", "null"], description: "Only bottles from this vintage or earlier. Null for no maximum." },
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

const SUGGESTION_PICK_SCHEMA = {
  type: "object",
  properties: {
    bottleId: { type: ["integer", "null"], description: "The id of an existing inventory bottle returned by browse_cellar, if recommending something the user already owns. Null if this is a gap suggestion - something not currently owned that would be worth adding to the wishlist instead." },
    pairingContext: { type: ["string", "null"], description: "For a pairing request only: which dish/course this wine goes with, in a few words (e.g. 'the grilled salmon'). Null for a tasting-flight request, or when there's only one dish and it's already obvious." },
    reason: { type: "string", description: "Why this wine - the pairing logic, or how it fits the tasting theme and its place in the tasting order. A sentence or two." },
    gapProducer: { type: ["string", "null"], description: "For a gap suggestion (bottleId null) only: a real, specific example producer for the style being suggested - not a vague placeholder. Null when bottleId is set." },
    gapType: { type: ["string", "null"], description: "For a gap suggestion only: a short style/variety label, matching the app's `type` field convention (e.g. 'Sancerre', 'Riesling'). Null when bottleId is set." },
    gapRegion: { type: ["string", "null"], description: "For a gap suggestion only. Null when bottleId is set." },
    gapCountry: { type: ["string", "null"], description: "For a gap suggestion only. Null when bottleId is set." },
  },
  required: ["bottleId", "pairingContext", "reason", "gapProducer", "gapType", "gapRegion", "gapCountry"],
  additionalProperties: false,
};

const SUGGESTIONS_TOOL = {
  name: "record_suggestions",
  description: "Record your final wine recommendations, after browsing the cellar as needed. For a tasting flight, list picks in suggested tasting order.",
  input_schema: {
    type: "object",
    properties: {
      mode: { type: "string", enum: ["pairing", "tasting"], description: "Which kind of request this was." },
      title: { type: "string", description: "A short evocative name for this recommendation - a few words, the way a flight is named on a tasting menu ('The Many Faces of Pinot', 'Chalk and Sea Air', 'Three Ways with the Lamb'). Title Case, no trailing punctuation, and specific to these actual wines rather than a generic label like 'Tasting Flight' or 'Pairing Suggestions'. This is the heading on its own - do not restate the explanation here, that is what summary is for." },
      summary: { type: "string", description: "The explanation behind the title: what the theme is, why these wines, and for a flight why they are in this order. Two to four sentences - this sits behind a 'Why these' disclosure, so it has room to be more than a caption." },
      picks: { type: "array", description: "One entry per recommended wine.", items: SUGGESTION_PICK_SCHEMA },
    },
    required: ["mode", "title", "summary", "picks"],
    additionalProperties: false,
  },
  strict: true,
};

function buildSuggestSystemPrompt(currentYear, includeOutside, character) {
  const outsideRule = includeOutside
    ? "They have asked to see wines beyond their own cellar for this request, so you may recommend wines they do not own wherever one would genuinely pair or fit better - not only as a fallback. Still prefer an owned bottle when it is a comparable match, since that is one they can open tonight; a wine they would have to go and buy has to earn its place by being clearly better for this. Record any such wine as a gap suggestion (bottleId null) with a real, specific producer, and say in its reason what it does that the owned options do not."
    : "Recommend only wines from their cellar. If nothing currently owned is a strong match, say so honestly and propose a specific gap suggestion (a real producer/style/region, not a vague category) worth adding to their wishlist, rather than forcing a mediocre owned bottle into the recommendation.";

  const steer = characterRule(character);
  const steerRule = steer ? `${steer} ` : "";

  return `You help a home wine collector decide what to open, in one of two ways: PAIRING (they describe a meal or dish, possibly with multiple courses - recommend one or more wines from their own cellar for it) or TASTING (they describe a theme, goal, or mood - build an ordered flight of wines from their cellar exploring it). Infer which one from their request. Use browse_cellar (repeatedly, with different filters, rather than assuming what's there) to find real candidates from their actual current inventory - never invent a bottle they don't have. A browse_cellar result with truncated true is a partial view - the first 40 matches by producer name, not the best 40 - so narrow the filters and browse again before deciding, and never call a pick the best in their cellar on the strength of a truncated browse. The current year is ${currentYear} - browse_cellar returns each bottle's drinkFrom/drinkTo drinking window where one is recorded (null means none is recorded, not that it's unready). Prefer a bottle whose window (if any) includes ${currentYear}; avoid one that's too young (${currentYear} < drinkFrom) or past peak (${currentYear} > drinkTo) unless nothing better fits, in which case say so plainly in your reasoning for that pick rather than silently ignoring it. Each window also carries drinkWindowEstimated: true means the years are the app's own guess rather than anything anyone looked up, so treat them as approximate and don't claim where they came from; false means they were read from a source or entered by the owner. The flag only means anything when drinkFrom or drinkTo is actually set - for a bottle with no window at all, ignore it. Choose between bottles using an estimated window exactly as you would a sourced one, but never quote an estimated one back as established fact - write "estimated to be drinking now" or "roughly 2024-2028", not "drinking right in its window (2024-2028)". Every other screen marks an estimate as an estimate, and a recommendation that quietly promotes a guess to a fact is the one way this feature misleads. ${outsideRule} ${steerRule}For a tasting flight, order picks in the sequence they should be tasted (typically lightest/driest to fullest/sweetest, or whatever logic fits the theme) and explain that ordering in the summary. Every answer needs both a title and a summary, and they do different jobs: the title is a short evocative name shown as the heading and saved as the flight's name, the summary is the fuller explanation shown behind it. Don't let the title swell into a sentence, and don't let the summary open by restating the title. Call record_suggestions exactly once, when you're done, with your final answer.`;
}

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

const MODEL_IDS = { opus: REASONING_MODEL, sonnet: EXTRACTION_MODEL };

// One full call, exactly what getSuggestions in app/actions.js does,
// parameterized by model instead of hard-coded to REASONING_MODEL - the
// one deliberate difference from the real thing, since that's the whole
// point of this script.
async function runSuggestion({ anthropic, pool, model, request, character, effort, includeOutside }) {
  const steer = normalizeCharacter(character);
  const level = normalizeEffort(effort);
  const outside = Boolean(includeOutside);
  const systemPrompt = buildSuggestSystemPrompt(new Date().getFullYear(), outside, steer);
  const messages = [{ role: "user", content: request }];

  const browseTrace = [];
  const usageTotals = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  const startedAt = Date.now();

  for (let turn = 0; turn < 6; turn++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      output_config: outputConfig(level),
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
  --models a,b       Which models to test: opus, sonnet, or both (default).
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
      const model = MODEL_IDS[modelKey];
      if (!model) {
        console.error(`Unknown model "${modelKey}" - use "opus" or "sonnet".`);
        continue;
      }
      console.log(`\n${modelKey.toUpperCase()} (${model}):`);
      for (let run = 1; run <= args.runs; run++) {
        try {
          const result = await runSuggestion({
            anthropic,
            pool,
            model,
            request: query.request,
            character: query.character ?? DEFAULT_CHARACTER,
            effort: query.effort ?? DEFAULT_EFFORT,
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
