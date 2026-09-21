"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { researchBottles, getResearchJob } from "@/app/actions";
import { isResearchJobStalled } from "@/lib/research-job";
import { ResearchRunContext, useResearchRun } from "@/app/components/research-run-context";

// A bulk run is a fact about the whole page, not about the button that
// starts it, so its state lives above both of the places that care.
//
// That isn't architecture for its own sake - it's the fix for something
// the first version of this got visibly wrong. The progress panel started
// out inside ResearchQueue, at the bottom of the page, under "Ready to
// review". Which meant that the further a run got, the further its own bar
// was pushed down the page by the proposals it was producing: on a phone,
// six bottles in, you had to scroll past five thousand pixels of results
// to see how far along it was. Watching the run and reading the results
// are different jobs, and the page has to be able to put them in different
// places. The button still needs to know a run is live, though - starting
// a second one over the same bottles would be a real mistake - so the two
// meet here instead of being wired to each other. The context object
// itself is in its own module - see research-run-context.js for why that
// matters more than it looks like it should.

// Fast enough that the bar feels attached to the work, slow enough that it
// isn't a query per second for something that moves once every twenty. One
// research pass is a live web search and several model turns, so the
// number this reads changes on that timescale, not this one.
const POLL_MS = 3000;

export function ResearchRunProvider({ activeJob = null, children }) {
  // Seeded from the page, so arriving at (or returning to) /research while
  // a run is in flight shows the run rather than an idle button. From then
  // on the poll below owns it, which is why this isn't kept in sync with
  // the prop: the poll is always the fresher of the two.
  const [job, setJob] = useState(activeJob);
  const router = useRouter();

  const stalled = isResearchJobStalled(job);
  const running = job?.status === "running" && !stalled;

  // Depends on the id and status rather than on `job` itself: every poll
  // sets a fresh object, and depending on that would tear down and rebuild
  // the interval on each tick.
  const jobId = job?.id ?? null;
  const jobStatus = job?.status ?? null;

  useEffect(() => {
    if (jobId == null || jobStatus !== "running") return;

    let cancelled = false;
    const timer = setInterval(async () => {
      const result = await getResearchJob(jobId);
      // A run whose row has gone (or whose read failed) shouldn't wipe the
      // last good numbers off the screen - it should just stop updating
      // them, and let the stalled check say so.
      if (!cancelled && result?.data) setJob(result.data);
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobId, jobStatus]);

  // Every few bottles that land are a few new proposals in "Ready to
  // review", so pull the server page again whenever the count moves. Keyed
  // on the count rather than on a timer: no movement, no refresh.
  const finishedCount = job ? job.researched + job.failed : 0;
  useEffect(() => {
    if (finishedCount > 0) router.refresh();
  }, [finishedCount, router]);

  // Returns an error message or null, so the caller can put it where its
  // own controls are rather than having errors surface up here, away from
  // the button that caused them.
  async function start(ids) {
    const result = await researchBottles(ids);
    if (result?.error) return result.error;
    setJob({
      id: result.data.jobId,
      total: result.data.total,
      researched: 0,
      failed: 0,
      status: "running",
      updatedAt: new Date().toISOString(),
    });
    return null;
  }

  return (
    <ResearchRunContext.Provider
      value={{ job, running, stalled, start, dismiss: () => setJob(null) }}
    >
      {children}
    </ResearchRunContext.Provider>
  );
}

// The bar, and the sentence that says what it means. Three states, because
// "finished" and "stopped partway" are genuinely different news and a bar
// that just sits at 40% tells you neither.
export function ResearchRunProgress() {
  const { job, running, stalled, dismiss } = useResearchRun();
  if (!job) return null;

  const done = job.researched + job.failed;
  const percent = job.total > 0 ? Math.round((done / job.total) * 100) : 0;

  const barClass = stalled
    ? "bg-amber-500"
    : running
      ? "bg-zinc-900 dark:bg-zinc-100"
      : "bg-green-600 dark:bg-green-500";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        {/* Polite rather than assertive: this updates every few seconds
            while someone may well be reading the results below it. */}
        <p aria-live="polite" className="font-medium">
          {running
            ? `Researching… ${done} of ${job.total}`
            : stalled
              ? `Research stopped after ${done} of ${job.total}`
              : `✓ Researched ${job.researched} of ${job.total}`}
          {job.failed > 0 && (
            <span className="font-normal text-zinc-500"> — {job.failed} failed</span>
          )}
        </p>
        {!running && (
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-xs text-zinc-500 underline underline-offset-2"
          >
            Hide
          </button>
        )}
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={job.total}
        aria-valuenow={done}
        aria-label={`Bulk research progress: ${done} of ${job.total} bottles`}
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${barClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="text-zinc-500">
        {running ? (
          <>
            This runs on the server, not in this tab — leave the page, close
            it, come back later; it keeps going either way, and this bar
            picks it back up.
          </>
        ) : stalled ? (
          <>
            It hasn&apos;t moved in a few minutes, so something interrupted
            it. Nothing already researched is lost — press “Research all”
            again, below, to pick up whatever is still waiting.
          </>
        ) : (
          <>They&apos;re waiting for review below.</>
        )}
      </p>
    </div>
  );
}
