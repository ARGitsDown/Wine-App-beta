// What a bulk-research job is, in facts both sides of the wire need. No
// imports on purpose: the progress bar is a client component and the step
// runner is server-only, and they agree about a run's shape here rather
// than each carrying their own copy of these numbers. Anything that can
// only happen on the server - minting a token, asking for the next
// invocation - lives in lib/research-dispatch.js instead, so importing
// this from the browser doesn't drag node:crypto in with it.

// Where one step hands the queue to the next. A plain route rather than
// the Server Action itself, because a Server Action is invoked through a
// framework-internal protocol (a POST to the page carrying a Next-Action
// header and an encoded action id) that isn't something to hand-craft a
// request for. The route is a thin wrapper that calls the action.
export const RESEARCH_STEP_PATH = "/api/research/step";

// How many of a job's pending ids a single step pulls in to group. Only an
// upper bound on how much a step *considers* - the deadline below decides
// how much it actually takes on. Big enough that two entries of the same
// wine usually land in the same step and share one search; small enough
// that the step never loads a hundred bottle rows to use two of them.
export const STEP_SLICE = 6;

// How long a step keeps starting new questions for. Not how long a step
// may run: the check happens before each question, so the last one it
// starts runs to completion however long it takes. A research pass is a
// live web search and several model turns and cannot usefully be cut off
// halfway, so the budget governs what a step *begins*, never what it
// abandons.
//
// Zero, which means one question per step. That is not the mechanism being
// switched off - it is the mechanism set for a 60s ceiling, measured
// rather than guessed. At the effort bulk research now runs (see
// BULK_RESEARCH_EFFORT in app/actions.js), one question measured 20s and
// 29s. Two in a step would be ~50s against the route's 60s maxDuration,
// which is no margin at all for a slow search; one leaves the whole budget
// to the single question that has to fit inside it.
//
// It looks wasteful and isn't: a handoff measured 7-10ms, so the entire
// cost of this conservatism is milliseconds per bottle, and what it buys
// is a fresh 60s for every question. Raise it if maxDuration ever rises -
// a plan allowing 300s could afford several questions per step.
export const STEP_BUDGET_MS = 0;

// A run whose chain has broken - a deploy mid-queue, a crash, a handoff
// that was accepted and then lost - leaves a row that says "running" and
// never changes again. Nothing can tell that apart from a step that is
// simply mid-search except elapsed time, so this is a judgement rather
// than a fact: generous enough that a slow question is never called dead,
// short enough that the page stops claiming to be working long before
// someone would otherwise sit and wait for it.
export const STALLED_AFTER_MS = 3 * 60 * 1000;

export function isResearchJobStalled(job) {
  if (!job || job.status !== "running") return false;
  return Date.now() - new Date(job.updatedAt).getTime() > STALLED_AFTER_MS;
}

// Several runs can be live at once: "Research all" is one, and each wine
// researched from its own row is another (see researchBottles), so the page
// watches a set of them. A run is { id, total, researched, failed, status,
// updatedAt, pendingIds }.
//
// Many runs read as one: their totals add, it is running while any is moving,
// paused or stopped only when none is and one has been. A finished set stays
// summarised as done until the next one starts, which is what the bar shows.
export function summarizeRuns(runs) {
  if (!runs || runs.length === 0) return null;
  let total = 0, researched = 0, failed = 0, live = 0, paused = 0, stalled = 0;
  for (const run of runs) {
    total += run.total;
    researched += run.researched;
    failed += run.failed;
    if (run.status === "running") {
      if (isResearchJobStalled(run)) stalled += 1;
      else live += 1;
    } else if (run.status === "paused") paused += 1;
  }
  return {
    total,
    researched,
    failed,
    running: live > 0,
    paused: live === 0 && paused > 0,
    stalled: live === 0 && paused === 0 && stalled > 0,
  };
}

// Where each wine in the live runs stands: "researching" for the one a run is
// working on (the front of its queue), "queued" for the rest of it. A run that
// has stalled or paused promises nothing, so its wines are not listed and read
// as idle again - the row's button is how they are picked up.
export function researchStates(runs) {
  const states = new Map();
  for (const run of runs ?? []) {
    if (run.status !== "running" || isResearchJobStalled(run)) continue;
    (run.pendingIds ?? []).forEach((id, index) => {
      if (!states.has(id)) states.set(id, index === 0 ? "researching" : "queued");
    });
  }
  return states;
}
