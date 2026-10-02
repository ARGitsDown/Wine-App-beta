import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { currentCellarmaster } from "@/lib/owner";
import { requestShape } from "@/lib/ai-models";
import { costMicros } from "@/lib/usage-pricing";
import {
  formatResetDate,
  monthStartUTC,
  nextMonthStartUTC,
  usageState,
} from "@/lib/usage-policy";

// The usage ledger and its two limits (FUTURE_CAPABILITIES.md, Phase 3),
// counted per Domaine: every Cellarmaster of one Domaine shares one monthly
// allowance on the owner's API key.
//
// Everything here is built around one rule: *measuring must never break the
// thing it measures.* A Suggest result someone is staring at must not fail
// because the row recording its cost didn't write, and a feature must not
// refuse to run because a usage query hiccuped. So reads fail open - an
// unknown month is treated as an ordinary one - and writes swallow and log.
// The one deliberate refusal is the hard stop, which is a decision about
// money, made on numbers that were actually read.
//
// Plain `prisma`, not lib/scoped-prisma.js: that client shows an account
// only its own rows and refuses guests, while the app owner reads this
// table across Domaines, and the Research step route calls in with no
// session at all.

// Where a Domaine stands this month. Never throws.
export async function monthlyUsage(domaineId, now = new Date()) {
  const resetsAt = nextMonthStartUTC(now);
  try {
    const [domaine, sum] = await Promise.all([
      prisma.domaine.findUnique({
        where: { id: domaineId },
        select: { monthlySpendCapCents: true, monthlyHardStopCents: true },
      }),
      prisma.usageEvent.aggregate({
        where: { domaineId, createdAt: { gte: monthStartUTC(now) } },
        _sum: { costMicros: true },
        _count: { _all: true },
      }),
    ]);
    const spentMicros = sum._sum.costMicros ?? 0;
    const limits = {
      capCents: domaine?.monthlySpendCapCents ?? null,
      hardStopCents: domaine?.monthlyHardStopCents ?? null,
    };
    return {
      known: true,
      spentMicros,
      calls: sum._count._all,
      ...limits,
      state: usageState({ spentMicros, ...limits }),
      resetsAt,
    };
  } catch (err) {
    console.error(`Couldn't read usage for Domaine ${domaineId}; treating it as under its limits:`, err);
    return {
      known: false,
      spentMicros: 0,
      calls: 0,
      capCents: null,
      hardStopCents: null,
      state: "ok",
      resetsAt,
    };
  }
}

// What a paused feature says. One message for every feature - like the
// rejected-key message in lib/ai-errors.js, this is a fact about the whole
// cellar, not about photos or pairings - and it says what still works and
// when it comes back, since "unavailable" with no reason reads as a bug.
export function pausedMessage(status) {
  return `AI features are paused until ${formatResetDate(status.resetsAt)} — this cellar has reached its monthly limit. Everything else still works normally. Whoever runs the app can raise the limit.`;
}

// Writes one ledger row. Never throws.
async function recordUsage({ domaineId, ownerId, feature, response, lighter }) {
  try {
    const model = response.model;
    const usage = response.usage ?? {};
    const { micros, assumed } = costMicros(model, usage);
    if (assumed) {
      console.error(`Unrecognized model "${model}" - priced as the most expensive. Add it to lib/usage-pricing.js.`);
    }
    await prisma.usageEvent.create({
      data: {
        domaineId,
        ownerId,
        feature,
        model: String(model),
        lighter,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
        cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
        webSearches: usage.server_tool_use?.web_search_requests ?? 0,
        costMicros: micros,
      },
    });
  } catch (err) {
    console.error(`Couldn't record ${feature} usage for Domaine ${domaineId}:`, err);
  }
}

// The one door every Claude call goes through.
//
//   const ai = await aiAccess();            // a signed-in Cellarmaster
//   const ai = await aiAccess({ id, domaineId });  // no session (Research step)
//   if (ai.paused) return { error: ai.message };
//   const response = await ai.call({ feature: "scan", tier: "extraction",
//     request: (shape) => ({ max_tokens: 8192, system, tools, messages }) });
//
// `aiAccess` reads the month once, up front, so a multi-turn loop (Scan,
// Suggest, Research all loop) runs on one model throughout - a mid-loop
// switch would change the model under a cached prefix and re-pay the cache
// write it exists to avoid. The cost is that a loop which crosses a limit
// partway finishes on the tier it started on: one call can overshoot, but
// never more than one. `call` adds the model-dependent request fields, sends
// it, and records what it cost.
//
// Not given a session, the caller must say whose month this is. Research's
// bulk steps run from a plain HTTP route with no cookies, so they pass the
// job's own ownerId and domaineId, the same reason ResearchJob carries them.
export async function aiAccess(who) {
  const { id: ownerId, domaineId } = who ?? (await currentCellarmaster());
  const status = await monthlyUsage(domaineId);
  const lighter = status.state === "lighter";

  return {
    domaineId,
    ownerId,
    status,
    paused: status.state === "stopped",
    lighter,
    message: pausedMessage(status),

    // `request(shape)` returns everything about the call except what
    // depends on the model (model, thinking, effort), which `shape` carries
    // - plus `shape.webSearchType` for the one call that uses web search.
    async call({ feature, tier, effort, request }) {
      if (status.state === "stopped") {
        // Callers check `paused` first and return a message; this is the
        // backstop for one that forgets, so a forgotten check can't spend.
        throw new Error("AI features are paused for this cellar.");
      }

      const attempt = async (useLighter) => {
        const shape = requestShape(tier, { lighter: useLighter, effort });
        const response = await anthropic.messages.create({
          ...shape.params,
          model: shape.model,
          ...request(shape),
        });
        await recordUsage({ domaineId, ownerId, feature, response, lighter: useLighter });
        return response;
      };

      try {
        return await attempt(lighter);
      } catch (err) {
        // The lighter model has never been run against these prompts. If it
        // rejects the request outright (a 400 - a parameter it doesn't
        // take), a feature that stops working is worse than one that costs
        // a little over its cap, so run it on the normal model once, and
        // say so loudly. Anything else - a rate limit, an outage - is not a
        // reason to spend more, and is rethrown as usual.
        if (lighter && err instanceof Anthropic.BadRequestError) {
          console.error(
            `${feature}: the lighter model rejected the request (${err.message}); retrying on the normal model.`
          );
          return attempt(false);
        }
        throw err;
      }
    },
  };
}
