"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  applyResearchProposal,
  applyResearch,
  dismissResearch,
} from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import Spinner from "@/app/components/Spinner";
import { researchChanges, isProposalStale } from "@/lib/research-fields";

const primaryButtonClass =
  "rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const secondaryButtonClass =
  "rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage]
    .filter(Boolean)
    .join(" ");
}

// Empty, null and 0-length all mean "nothing on file" and should read that
// way rather than as a blank cell you can't tell apart from a space.
function show(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return String(value);
}

function Value({ value, muted }) {
  const text = show(value);
  if (text === null) {
    return <span className="italic text-zinc-400">not set</span>;
  }
  // A synthesis of several critics runs to paragraphs; the diff is for
  // seeing that it changed and roughly to what, not for reading it whole.
  const clipped = text.length > 140 ? `${text.slice(0, 140)}…` : text;
  return <span className={muted ? "text-zinc-500 line-through" : ""}>{clipped}</span>;
}

export default function ResearchProposalCard({ bottle, proposal, regionOptions }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const changes = researchChanges(bottle, proposal.proposed);
  const stale = isProposalStale(bottle, proposal);

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await applyResearchProposal(bottle.id);
      if (result?.error) setError(result.error);
    });
  }

  function keep() {
    setError(null);
    startTransition(async () => {
      await dismissResearch(bottle.id);
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/bottles/${bottle.id}`}
          className="font-medium underline underline-offset-2"
        >
          {bottleHeader(bottle)}
        </Link>
        <span className="text-xs capitalize text-zinc-500">{bottle.status}</span>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">{proposal.summary}</p>

      {/* Flagged, not prevented: you can see current beside proposed and
          decide for yourself, which is the whole reason the diff exists. */}
      {stale && (
        <p className="rounded border border-amber-300 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:text-amber-400">
          This bottle has been edited since the research ran. The
          &ldquo;now&rdquo; column below is current, so anything you accept
          will overwrite it.
        </p>
      )}

      {changes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Research confirmed every field as it stands — nothing to change.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-1 pr-3 font-medium">Field</th>
                <th className="py-1 pr-3 font-medium">Now</th>
                <th className="py-1 font-medium">Proposed</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((change) => (
                <tr key={change.key} className="border-t border-zinc-100 align-top dark:border-zinc-800">
                  <td className="py-1.5 pr-3 text-zinc-500">{change.label}</td>
                  <td className="py-1.5 pr-3">
                    <Value value={change.from} muted />
                  </td>
                  <td className="py-1.5">
                    <Value value={change.to} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {proposal.sources.length > 0 && (
        <details className="text-xs text-zinc-500">
          <summary className="cursor-pointer">
            {proposal.sources.length} source{proposal.sources.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {proposal.sources.map((url) => (
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
        </details>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {changes.length > 0 && (
          <button
            type="button"
            onClick={accept}
            disabled={pending}
            className={primaryButtonClass}
          >
            Accept {changes.length} change{changes.length === 1 ? "" : "s"}
          </button>
        )}
        {/* Editing is the escape hatch for a proposal that is right about
            four fields and wrong about one - the common shape of a research
            result, and the reason approval is whole-proposal but editable
            rather than all-or-nothing. */}
        <button
          type="button"
          onClick={() => setEditing((was) => !was)}
          disabled={pending}
          className={secondaryButtonClass}
        >
          {editing ? "Cancel edit" : "Edit first"}
        </button>
        <button type="button" onClick={keep} disabled={pending} className={secondaryButtonClass}>
          Keep as is
        </button>
        {pending && <Spinner label="Saving…" />}
      </div>

      {editing && (
        <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <BottleForm
            action={applyResearch.bind(null, bottle.id)}
            defaultValues={{ ...bottle, ...proposal.proposed }}
            submitLabel="Save these changes"
            regionOptions={regionOptions}
            idPrefix={`research-${bottle.id}`}
          />
        </div>
      )}
    </li>
  );
}
