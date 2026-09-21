"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { researchBottle, dismissResearch } from "@/app/actions";
import { useResearchRun } from "@/app/components/research-run-context";
import Spinner from "@/app/components/Spinner";

const secondaryButtonClass =
  "rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-50 dark:border-zinc-700";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage, bottle.type]
    .filter(Boolean)
    .join(" ");
}

export default function ResearchQueue({ bottles }) {
  // Which bottle is mid-research, not merely "something is running": one
  // shared flag would disable every row's button while any one of them
  // worked.
  const [busyId, setBusyId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [, startTransition] = useTransition();

  // The run itself belongs to the page, not to this list - its progress
  // bar is rendered up at the top, where it isn't buried under the results
  // it produces. What this needs from it is only whether one is live.
  const { running, start } = useResearchRun();

  function researchOne(id) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await researchBottle(id);
      if (result?.error) setError(result.error);
      setBusyId(null);
    });
  }

  // One call, and what comes back is a job to watch rather than a tally:
  // the queue lives in a row now and each step asks for its own invocation
  // to run in (see researchBottles in app/actions.js), so there is nothing
  // for this tab to drive and nothing it can stop by closing.
  async function researchAll() {
    setError(null);
    setConfirming(false);
    setStarting(true);
    const message = await start(bottles.map((bottle) => bottle.id));
    setStarting(false);
    if (message) setError(message);
  }

  if (bottles.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing waiting to be researched.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Hidden while a run is live, shown again the moment it isn't - a
          finished or interrupted run leaves whatever it couldn't get to
          listed below, and starting again is how those get picked up. */}
      {!running &&
        (starting ? (
          <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
            <Spinner label={`Starting research for ${bottles.length} bottle${bottles.length === 1 ? "" : "s"}…`} />
          </div>
        ) : confirming ? (
          /* Named outright, because this is the app's only web-search call and
             its most expensive by a distance - one tap here is one search per
             bottle, not one search. */
          <div className="flex flex-col gap-2 rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-900">
            <p>
              This runs a live web search for each of the {bottles.length}{" "}
              bottle{bottles.length === 1 ? "" : "s"} below — {bottles.length}{" "}
              search{bottles.length === 1 ? "" : "es"} in total. Results wait
              for your review; nothing is saved automatically.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={researchAll}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Research all {bottles.length}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
          >
            Research all {bottles.length} →
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
              <span className="text-xs capitalize text-zinc-500">{bottle.status}</span>
              <button
                type="button"
                onClick={() => researchOne(bottle.id)}
                disabled={busyId === bottle.id || starting || running}
                className={secondaryButtonClass}
              >
                {busyId === bottle.id ? "Researching…" : "Research"}
              </button>
              <form action={dismissResearch.bind(null, bottle.id)}>
                <button
                  type="submit"
                  className="text-xs text-zinc-500 underline underline-offset-2"
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
