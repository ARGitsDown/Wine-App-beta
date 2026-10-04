"use client";

import { useState } from "react";
import Link from "next/link";
import { dismissResearch } from "@/app/actions";
import { useResearchRun } from "@/app/components/research-run-context";
import Spinner from "@/app/components/Spinner";
import StatusBadge from "@/app/components/StatusBadge";

// min-h-11 rather than the app's more common py-1.5: this button and
// Dismiss beside it were ~20px tall, the one control on this page that
// missed the "thumb-sized or it's decoration" standard the rest of the
// app holds to (BACKLOG #29 polish note).
const secondaryButtonClass =
  "inline-flex min-h-11 items-center rounded border border-zinc-300 px-3 text-xs disabled:opacity-50 dark:border-zinc-700";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage, bottle.type]
    .filter(Boolean)
    .join(" ");
}

export default function ResearchQueue({ bottles }) {
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  // Wines whose tap has gone out and whose run has not come back yet, so a
  // second tap in that gap does nothing.
  const [sending, setSending] = useState(() => new Set());
  const [error, setError] = useState(null);

  // The runs belong to the page, not to this list - their progress bar is
  // rendered up at the top, where it isn't buried under the results it
  // produces. What this needs from them is where each wine stands.
  const { stateOf, start } = useResearchRun();

  const stateFor = (id) => (sending.has(id) ? "queued" : stateOf(id));

  // One wine from its own row joins the same background queue as "Research
  // all": it runs on the server, several can be asked for in a row without
  // waiting on each other's answer, and a wine already being researched is
  // refused rather than paid for twice.
  async function researchOne(id) {
    setError(null);
    setSending((prev) => new Set(prev).add(id));
    const message = await start([id]);
    setSending((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (message) setError(message);
  }

  // One call, and what comes back is a run to watch rather than a tally:
  // the queue lives in a row now and each step asks for its own invocation
  // to run in (see researchBottles in app/actions.js), so there is nothing
  // for this tab to drive and nothing it can stop by closing. Only wines not
  // already in a run: the others are being paid for.
  const idle = bottles.filter((bottle) => !stateFor(bottle.id));
  async function researchAll() {
    setError(null);
    setConfirming(false);
    setStarting(true);
    const message = await start(idle.map((bottle) => bottle.id));
    setStarting(false);
    if (message) setError(message);
  }

  if (bottles.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing waiting to be researched.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden only when every wine is already in a run; a run that is live
          for a few leaves the rest to start, and a finished or interrupted run
          leaves whatever it couldn't get to listed below. */}
      {idle.length > 0 &&
        (starting ? (
          <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <Spinner label={`Starting research for ${idle.length} bottle${idle.length === 1 ? "" : "s"}…`} />
          </div>
        ) : confirming ? (
          /* Named outright, because this is the app's only web-search call and
             its most expensive by a distance - one tap here is one search per
             bottle, not one search. */
          <div className="flex flex-col gap-2 rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-900">
            <p>
              This runs a live web search for each of the {idle.length}{" "}
              bottle{idle.length === 1 ? "" : "s"} below — {idle.length}{" "}
              search{idle.length === 1 ? "" : "es"} in total. Results wait
              for your review; nothing is saved automatically.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={researchAll}
                className="min-h-11 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Research all {idle.length}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="min-h-11 self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Research all {idle.length} →
          </button>
        ))}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="flex flex-col gap-1.5">
        {bottles.map((bottle) => (
          <li
            key={bottle.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
          >
            <Link
              href={`/bottles/${bottle.id}`}
              className="font-medium underline underline-offset-2"
            >
              {bottleHeader(bottle)}
            </Link>
            <div className="flex shrink-0 items-center gap-3">
              <StatusBadge status={bottle.status} />
              <button
                type="button"
                onClick={() => researchOne(bottle.id)}
                disabled={Boolean(stateFor(bottle.id)) || starting}
                className={secondaryButtonClass}
              >
                {stateFor(bottle.id) === "researching"
                  ? "Researching…"
                  : stateFor(bottle.id) === "queued"
                    ? "Queued"
                    : "Research"}
              </button>
              <form action={dismissResearch.bind(null, bottle.id)}>
                <button
                  type="submit"
                  className="-mx-2 rounded px-2 py-2 text-xs text-zinc-500 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
                >
                  Dismiss
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
