"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

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
//
// `doneMessage`, when given, is for an action whose control *stays on
// screen* afterwards - a role change, where the same row now offers the
// opposite change. Without it the box stayed open after a successful save
// and quietly re-armed for the reverse, which read as "that didn't work"
// and invited the tap that undid it (BACKLOG #53). With it, the box closes
// once the action has finished and the message says what happened. Not
// used for deletes: their row disappears, which is its own confirmation,
// and some of them redirect away.
export default function ConfirmButton({
  action,
  label,
  confirmLabel = "Yes, delete",
  warning,
  className,
  confirmClassName,
  tone = "danger",
  doneMessage,
}) {
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);

  if (!armed) {
    return (
      // `contents`, so the button and its message lay out as children of
      // whatever row this sits in - letting the message take a full line of
      // its own under the row's buttons, rather than wedging between them
      // and pushing the next button onto a line by itself.
      <span className="contents">
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setArmed(true);
          }}
          className={className}
        >
          {label}
        </button>
        {done && doneMessage && (
          <span role="status" className="order-last basis-full text-xs text-green-700 dark:text-green-400">
            ✓ {doneMessage}
          </span>
        )}
      </span>
    );
  }

  const formAction = doneMessage
    ? async (formData) => {
        await action(formData);
        setArmed(false);
        setDone(true);
      }
    : action;

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
      <form action={formAction} className="contents">
        <ConfirmSubmit className={confirmClassName ?? className} label={confirmLabel} />
      </form>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      >
        Cancel
      </button>
    </span>
  );
}

// Its own component because useFormStatus only reports on the form it is
// rendered *inside*. While the action runs the button says so and stops
// taking taps - without that, a slow save looked like nothing happened,
// and a second tap was the natural response.
function ConfirmSubmit({ className, label }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-50`}>
      {pending ? "Working…" : label}
    </button>
  );
}
