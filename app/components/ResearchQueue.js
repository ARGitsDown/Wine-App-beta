"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { researchBottle, researchBottles, dismissResearch } from "@/app/actions";
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
  const [bulk, setBulk] = useState(null); // { total, firstStepDone, firstStepFailed, remaining }
  const [error, setError] = useState(null);
  const [, startTransition] = useTransition();

  function researchOne(id) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const result = await researchBottle(id);
      if (result?.error) setError(result.error);
      setBusyId(null);
    });
  }

  // One call, not a loop of them: chunking and chaining through the whole
  // queue now happens server-side (see researchBottles in app/actions.js),
  // scheduling each next step with `after()` so it keeps going even if
  // this tab closes right after this call returns. What comes back here
  // is only the first step's own tally - `remaining` says how much more
  // is already queued behind it.
  async function researchAll() {
    setError(null);
    setConfirming(false);
    setStarting(true);
    const ids = bottles.map((bottle) => bottle.id);
    const result = await researchBottles(ids);
    setStarting(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setBulk({
      total: ids.length,
      firstStepDone: (result.data.researched ?? 0) + (result.data.failed ?? 0),
      firstStepFailed: result.data.failed ?? 0,
      remaining: result.data.remaining ?? 0,
    });
  }

  if (bottles.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing waiting to be researched.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {starting ? (
        <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <Spinner label={`Starting research for ${bottles.length} bottle${bottles.length === 1 ? "" : "s"}…`} />
        </div>
      ) : bulk ? (
        <div className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <p className="font-medium text-green-700 dark:text-green-400">
            ✓ Researched {bulk.firstStepDone - bulk.firstStepFailed} of {bulk.total} so far
            {bulk.firstStepFailed > 0 && ` — ${bulk.firstStepFailed} failed`}.
          </p>
          {/* Honest about what actually happens now: the rest keeps
              running on the server, not in this tab, so there is nothing
              left here to watch tick upward - closing this page no longer
              stops it (BACKLOG #17/#29). */}
          {bulk.remaining > 0 ? (
            <p className="mt-1 text-zinc-500">
              {bulk.remaining} more {bulk.remaining === 1 ? "is" : "are"} still
              queued and will keep going even if you leave this page - check
              back here to see them land.
            </p>
          ) : (
            <p className="mt-1 text-zinc-500">They&apos;re waiting for review above.</p>
          )}
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
      )}

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
                disabled={busyId === bottle.id || starting || bulk !== null}
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
