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
// starts can push well past this. That's the point of the number being
// this far below the route's 60s maxDuration - one research pass is a live
// web search and several model turns, and it needs room to finish rather
// than being cut off at the knees.
//
// The consequence is that a step usually does one or two questions and
// then hands off, which looks wasteful and isn't: a handoff is one cheap
// HTTP request, and what it buys is a fresh timeout every time. That is
// the difference between a queue with a ceiling and a queue without one.
export const STEP_BUDGET_MS = 20_000;

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
