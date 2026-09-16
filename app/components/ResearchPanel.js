"use client";

import { useState, useTransition } from "react";
import { researchBottle, dismissResearch } from "@/app/actions";
import ResearchProposalCard from "@/app/components/ResearchProposalCard";
import Spinner from "@/app/components/Spinner";
import { EFFORT_LEVELS, DEFAULT_EFFORT } from "@/lib/effort";

const primaryButtonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700";

// Runs a real web search (not just the model's training knowledge) against
// this bottle's current fields and files the answer as a proposal.
//
// The result is stored rather than held in React state, which is what lets
// it survive navigating away - and means this page and /research show the
// same thing through the same component, instead of two flows that could
// drift apart.
export default function ResearchPanel({ bottle, proposal, regionOptions }) {
  const [error, setError] = useState(null);
  const [effort, setEffort] = useState(DEFAULT_EFFORT);
  const [pending, startTransition] = useTransition();

  function research() {
    setError(null);
    startTransition(async () => {
      const result = await researchBottle(bottle.id, effort);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300 p-4 dark:border-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Research</h2>
          <p className="text-sm text-zinc-500">
            {proposal
              ? "A web search has run — review what it proposes below."
              : bottle.needsResearch
                ? "Flagged during scanning — some fields weren't confidently read."
                : "Double-check or fill in details for this bottle with an actual web search."}
          </p>
        </div>
        {/* No shrink-0: with only the two buttons the row always fitted,
            but a third control needs to be allowed to shrink or it pushes
            the last button off the edge of the panel at phone width. */}
        <div className="flex flex-wrap items-center gap-2">
          {/* A select rather than the radio row Suggest uses. There is no
              form here - just two buttons on one line - and three radios
              wrapping under them would read as a question nobody asked.
              The label is the word itself, since "Balanced" alone says
              nothing about what it is balancing. */}
          <label className="flex items-center gap-1.5 text-sm text-zinc-500">
            Effort
            <select
              value={effort}
              onChange={(event) => setEffort(event.target.value)}
              disabled={pending}
              title={EFFORT_LEVELS.find((level) => level.value === effort)?.hint}
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              {EFFORT_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>
          {bottle.needsResearch && !proposal && (
            <form action={dismissResearch.bind(null, bottle.id)}>
              <button type="submit" className={secondaryButtonClass}>
                Dismiss
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={research}
            disabled={pending}
            className={primaryButtonClass}
          >
            {pending ? (
              <Spinner label="Researching…" />
            ) : proposal ? (
              "Research again"
            ) : (
              "Research further"
            )}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {proposal && (
        <ul className="border-t border-amber-200 pt-3 dark:border-amber-900">
          <ResearchProposalCard
            bottle={bottle}
            proposal={proposal}
            regionOptions={regionOptions}
          />
        </ul>
      )}
    </section>
  );
}
