"use client";

import { useState } from "react";
import { researchBottle, applyResearch, dismissResearch } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import SavedWatcher from "@/app/components/SavedWatcher";

const primaryButtonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";
const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";

// Runs a real web search (not just the model's training knowledge) against
// this bottle's current fields and shows the result as an editable,
// prefilled form - nothing is saved until the user reviews and submits it,
// same trust model as the scan and suggest features.
export default function ResearchPanel({ bottle }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [applied, setApplied] = useState(false);

  async function handleResearch() {
    setLoading(true);
    setError(null);
    setResult(null);
    const response = await researchBottle(bottle.id);
    if (response.error) {
      setError(response.error);
    } else {
      setResult(response.data);
    }
    setLoading(false);
  }

  if (applied) {
    return (
      <p className="text-sm font-medium text-green-700 dark:text-green-400">
        ✓ Applied — details above are updated.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-amber-300 p-4 dark:border-amber-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-medium">Research</h2>
          <p className="text-sm text-zinc-500">
            {bottle.needsResearch
              ? "Flagged during scanning — some fields weren't confidently read."
              : "Double-check or fill in details for this bottle with an actual web search."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {bottle.needsResearch && !result && (
            <form action={dismissResearch.bind(null, bottle.id)}>
              <button type="submit" className={secondaryButtonClass}>
                Dismiss
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={handleResearch}
            disabled={loading}
            className={primaryButtonClass}
          >
            {loading ? "Researching…" : "Research further"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="flex flex-col gap-3 border-t border-amber-200 pt-3 dark:border-amber-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.summary}</p>
          {result.sources.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-zinc-500">
              {result.sources.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-zinc-500">
            Review and edit below — nothing changes until you save.
          </p>
          <BottleForm
            action={applyResearch.bind(null, bottle.id)}
            defaultValues={{ ...bottle, ...result }}
            submitLabel="Apply these changes"
          >
            <SavedWatcher onSaved={() => setApplied(true)} />
          </BottleForm>
        </div>
      )}
    </section>
  );
}
