"use client";

import { useState, useTransition } from "react";
import { estimateWindowForBottle } from "@/app/actions";
import Spinner from "@/app/components/Spinner";

// Offered only where there is no window at all, which is the same gap the
// bulk pass looks for. A half-open window ("drink from 2030", no end) is a
// deliberate answer rather than a hole, so it isn't offered there.
//
// Cheaper and narrower than Research: producer, variety, region and vintage
// against the model's own knowledge, no web search. The result is stored
// marked as an estimate, so it reads as something to refine rather than as
// a fact someone checked.
export default function EstimateWindowButton({ bottleId }) {
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function estimate() {
    setError(null);
    startTransition(async () => {
      const result = await estimateWindowForBottle(bottleId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={estimate}
        disabled={pending}
        title="Estimate from the producer, variety, region and vintage"
        className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
      >
        {pending ? <Spinner label="Estimating…" /> : "Estimate drinking window"}
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </>
  );
}
