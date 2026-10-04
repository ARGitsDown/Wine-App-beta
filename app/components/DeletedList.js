"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { restoreBottle } from "@/app/actions";

// `rows` seeds the list once. A restore revalidates paths, which re-renders
// this page without the restored wine; keeping the first list is what lets the
// row stay and say "Restored" instead of vanishing.
export default function DeletedList({ rows: initialRows }) {
  const [rows] = useState(initialRows);
  const [restored, setRestored] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing deleted lately.</p>;
  }

  function restore(id) {
    setBusy(id);
    setErrors((prev) => ({ ...prev, [id]: null }));
    startTransition(async () => {
      const result = await restoreBottle(id);
      if (result?.ok) setRestored((prev) => ({ ...prev, [id]: result.bottleId }));
      else setErrors((prev) => ({ ...prev, [id]: result?.error ?? "Couldn't restore that wine." }));
      setBusy(null);
    });
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-zinc-200 px-4 py-2 text-sm dark:border-zinc-800"
        >
          <span className="min-w-0 flex-1">
            <span className="font-medium">{row.label}</span>
            <span className="block text-xs text-zinc-500">
              {row.list ? `From ${row.list} \u00b7 ` : ""}Deleted {row.deleted} · {row.daysLeft} day{row.daysLeft === 1 ? "" : "s"} left
            </span>
          </span>
          {restored[row.id] ? (
            <Link href={`/bottles/${restored[row.id]}`} className="flex min-h-11 items-center underline underline-offset-2">
              {row.list ? `Restored to ${row.list}` : "Restored"} · view
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => restore(row.id)}
              disabled={pending}
              className="min-h-11 rounded border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              {busy === row.id ? "Restoring…" : "Restore"}
            </button>
          )}
          {errors[row.id] && <span className="w-full text-red-600 dark:text-red-400">{errors[row.id]}</span>}
        </li>
      ))}
    </ul>
  );
}
