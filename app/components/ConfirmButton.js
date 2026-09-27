"use client";

import { useState } from "react";

// A destructive action that asks first. Deliberately a two-step inline
// control rather than a native confirm() dialog: this can say what
// specifically is about to be lost ("and its 3 tasting notes"), which is
// the part worth pausing over, and a browser dialog can't be styled, reads
// as a system error on mobile, and is suppressible.
//
// `action` is whatever React accepts as a form action - usually a bound
// Server Action, or a client function where the delete is a few actions in
// a row. Nothing runs until the second click, so the first one is free to
// be a mis-tap.
//
// `tone` is "danger" (the default - a delete, a revoke) or "neutral", for
// a change worth confirming that isn't destructive, like making someone a
// Cellarmaster; a red box around that would read as a warning it isn't.
export default function ConfirmButton({
  action,
  label,
  confirmLabel = "Yes, delete",
  warning,
  className,
  confirmClassName,
  tone = "danger",
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={className}>
        {label}
      </button>
    );
  }

  return (
    <span
      className={`inline-flex flex-wrap items-center gap-2 rounded-lg border px-3 py-1.5 ${
        tone === "neutral"
          ? "border-zinc-300 dark:border-zinc-700"
          : "border-red-300 dark:border-red-900"
      }`}
    >
      {warning && (
        <span
          className={`text-xs ${
            tone === "neutral" ? "text-zinc-600 dark:text-zinc-400" : "text-red-700 dark:text-red-400"
          }`}
        >
          {warning}
        </span>
      )}
      <form action={action} className="contents">
        <button type="submit" className={confirmClassName ?? className}>
          {confirmLabel}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="text-xs text-zinc-500 underline underline-offset-2"
      >
        Cancel
      </button>
    </span>
  );
}
