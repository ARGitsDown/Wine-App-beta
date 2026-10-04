"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { renameLocation, undoRenameLocation } from "@/app/actions";
import { useUndo } from "@/app/components/UndoToast";
import { summarizeCellar } from "@/lib/cellar-overview";
import { WINDOW_LABELS } from "@/lib/filter-bottles";

const chipBase =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100";

// The shape of the cellar at the top of the Cellar page: how many are ready,
// and the colours, regions and places they are spread over. Every count is a
// button that applies the matching filter (tap it again to take it off), so it
// is a way into the list rather than a second thing to read. Counts come from
// the whole cellar, not the filtered view: the overview describes what you
// own, and a filter it responded to would shrink under the finger.
//
// Closed by default with the headline on the summary line, so a cellar of
// hundreds still opens on the list.
export default function CellarOverview({ bottles, filters, onFilter }) {
  const summary = useMemo(() => summarizeCellar(bottles), [bottles]);
  const detailsRef = useRef(null);
  const showUndo = useUndo();
  const [renaming, setRenaming] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  if (summary.wines === 0) return null;

  const ready = summary.window.ready;
  const headline = [
    `${summary.wines} wine${summary.wines === 1 ? "" : "s"}`,
    summary.bottles !== summary.wines ? `${summary.bottles} bottles` : null,
    ready > 0
      ? summary.readyEstimated > 0
        ? `${ready} ready now (${summary.readyEstimated} estimated)`
        : `${ready} ready now`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The list is below the summary and off-screen on a phone, so a tap closes
  // the summary to bring the narrowed list up.
  function toggle(key, value) {
    onFilter(key, filters[key] === value ? "" : value);
    if (detailsRef.current) detailsRef.current.open = false;
  }

  function chip(key, value, label, count) {
    const on = filters[key] === value;
    return (
      <button
        key={`${key}:${value}`}
        type="button"
        aria-pressed={on}
        onClick={() => toggle(key, value)}
        className={`${chipBase} ${
          on
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700"
        }`}
      >
        {label}
        <span className={on ? "opacity-80" : "text-zinc-500"}>{count}</span>
      </button>
    );
  }

  function submitRename(event) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await renameLocation(from, to);
      if (result?.error) {
        setError(result.error);
        return;
      }
      // A filter on the old name would now match nothing.
      if (filters.location === from) onFilter("location", result.to);
      if (result.ids?.length > 0) {
        const n = result.ids.length;
        const verb = result.merged ? `Merged ${result.from} into ${result.to}` : `Renamed ${result.from} to ${result.to}`;
        showUndo(`${verb} (${n} wine${n === 1 ? "" : "s"})`, async () => {
          const undone = await undoRenameLocation(result.ids, result.from, result.to);
          if (undone?.ok && filters.location === result.to) onFilter("location", result.from);
          return undone;
        });
      }
      setRenaming(false);
      setFrom("");
      setTo("");
    });
  }

  const group = (title, children) => (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );

  return (
    <details ref={detailsRef} className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <summary className="min-h-11 cursor-pointer px-4 py-2.5 text-sm">
        <span className="font-medium">Cellar at a glance</span>
        <span className="ml-2 text-xs text-zinc-400">tap a count to filter</span>
        <span className="ml-2 text-zinc-500">{headline}</span>
      </summary>
      <div className="flex flex-col gap-4 border-t border-zinc-200 p-4 dark:border-zinc-800">
        {group(
          "Drinking",
          Object.entries(WINDOW_LABELS)
            .filter(([value]) => summary.window[value] > 0)
            .map(([value, label]) => chip("window", value, label, summary.window[value]))
        )}
        {summary.colors.length > 0 &&
          group(
            "Color",
            summary.colors.map(({ key, count }) => chip("wineColor", key, key, count))
          )}
        {summary.regions.length > 0 &&
          group(
            "Regions",
            summary.regions.map(({ key, count }) => chip("region", key, key, count))
          )}
        {summary.locations.length > 0 &&
          group(
            "Places",
            summary.locations.map(({ key, count }) => chip("location", key, key, count))
          )}
        {summary.locations.length > 0 && (
          <div className="flex flex-col gap-2">
            {!renaming ? (
              <button
                type="button"
                onClick={() => {
                  setRenaming(true);
                  setFrom(summary.locations[0].key);
                  setTo("");
                }}
                className="min-h-11 self-start text-sm text-zinc-500 underline underline-offset-2"
              >
                Rename a place
              </button>
            ) : (
              <form onSubmit={submitRename} className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  Place
                  <select
                    value={from}
                    onChange={(event) => setFrom(event.target.value)}
                    className="min-h-11 rounded border border-zinc-300 px-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {summary.locations.map(({ key }) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-500">
                  New name
                  <input
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    maxLength={80}
                    className="min-h-11 rounded border border-zinc-300 px-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </label>
                <button
                  type="submit"
                  disabled={pending || !to.trim()}
                  className="min-h-11 rounded bg-zinc-900 px-3 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => setRenaming(false)}
                  className="min-h-11 rounded border border-zinc-300 px-3 text-sm dark:border-zinc-700"
                >
                  Cancel
                </button>
                <p className="w-full text-xs text-zinc-500">
                  Naming a place that already exists merges the two.
                </p>
                {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
              </form>
            )}
          </div>
        )}
        {summary.unplaced > 0 && summary.locations.length > 0 && (
          <p className="text-xs text-zinc-500">{summary.unplaced} without a place</p>
        )}
      </div>
    </details>
  );
}
