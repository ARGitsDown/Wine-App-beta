"use client";

import { useState, useTransition } from "react";
import { undoImport } from "@/app/(owner)/import/actions";

// Imports from the last 30 days that still have wines in them, each with an
// Undo that is as careful as the one on the import screen: wines you have since
// changed or added to are kept and counted.
// Undoing revalidates the page, and the batch is then gone from `batches`; the
// row is kept (as its result message) so what was kept is still readable.
export default function RecentImports({ batches: current }) {
  const [results, setResults] = useState({});
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(null);

  const batches = [
    ...current,
    ...Object.keys(results)
      .map(Number)
      .filter((id) => !current.some((batch) => batch.id === id))
      .map((id) => ({ id })),
  ].sort((a, b) => b.id - a.id);

  if (batches.length === 0) return null;

  function undo(id) {
    setBusy(id);
    startTransition(async () => {
      const result = await undoImport(id);
      setResults((prev) => ({ ...prev, [id]: result }));
      setBusy(null);
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">Recent imports</h2>
      <ul className="flex flex-col gap-1.5">
        {batches.map((batch) => {
          const result = results[batch.id];
          return (
            <li
              key={batch.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
            >
              {result?.ok ? (
                <span>
                  Undone: removed {result.removed} wine{result.removed === 1 ? "" : "s"}.
                  {result.kept > 0 && ` Kept ${result.kept} you've changed or added to since.`}
                </span>
              ) : (
                <>
                  <span>
                    {batch.remaining} wine{batch.remaining === 1 ? "" : "s"} to the {batch.destination} ·{" "}
                    {batch.when}
                  </span>
                  <button
                    type="button"
                    onClick={() => undo(batch.id)}
                    disabled={pending}
                    className="ml-auto min-h-11 rounded border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
                  >
                    {busy === batch.id ? "Undoing…" : "Undo import"}
                  </button>
                  {result?.error && <span className="w-full text-red-600 dark:text-red-400">{result.error}</span>}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
