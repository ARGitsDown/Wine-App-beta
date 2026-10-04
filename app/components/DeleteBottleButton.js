"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteBottle, restoreBottle } from "@/app/actions";
import { useUndo } from "@/app/components/UndoToast";

// The wine page's delete: a two-step confirm like ConfirmButton, but a client
// control of its own because the delete no longer redirects. It navigates to
// the list the wine was on and leaves "Deleted X · Undo" in the layout's
// toast, which survives the navigation (the Undo has to outlive this page).
export default function DeleteBottleButton({ bottleId, warning, className }) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const showUndo = useUndo();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteBottle(bottleId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push(result.path);
      showUndo(`Deleted ${result.label} \u00b7 kept 30 days in Recently deleted`, () => restoreBottle(result.trashId));
    });
  }

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={className}>
        Delete this wine
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-red-300 px-3 py-1.5 dark:border-red-900">
      {warning && <span className="text-xs text-red-700 dark:text-red-400">{warning}</span>}
      <button
        type="button"
        onClick={confirm}
        disabled={pending}
        className={`${className} disabled:opacity-50`}
      >
        {pending ? "Working…" : "Yes, delete"}
      </button>
      <button
        type="button"
        data-offline-ok
        onClick={() => setArmed(false)}
        disabled={pending}
        className="min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        Cancel
      </button>
      {error && <span className="w-full text-sm text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
