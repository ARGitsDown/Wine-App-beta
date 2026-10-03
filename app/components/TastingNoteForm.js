"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { addTastingNote } from "@/app/actions";
import Spinner from "@/app/components/Spinner";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-base dark:border-zinc-700 dark:bg-zinc-900";

// The note form on a bottle's page, as a client component so it can say what
// happened. It was a plain <form>: the button never disabled, nothing said
// "saved", and React reset the fields to their starting text, so a saved note
// looked like one that never sent - the natural next move was to type it again
// (BACKLOG #61). Now: "Saving..." while it works, then a "Note saved" panel in
// place of the form, with - when the person came from a flight - a button
// that names the flight and goes back to it.
//
// `back` is { href, label } or null. The page's own list of notes updates
// underneath (addTastingNote revalidates it).
export default function TastingNoteForm({ bottleId, defaultNote = "", today, back = null, title = null }) {
  const [state, formAction, pending] = useActionState(
    (prev, formData) => addTastingNote(bottleId, prev, formData),
    null
  );
  // Kept in state, not left to the fields: React resets an uncontrolled form
  // after every action, which on a failed save would wipe what was typed.
  const [note, setNote] = useState(defaultNote);
  const [rating, setRating] = useState("");
  const [tastedAt, setTastedAt] = useState(today);
  const [dismissed, setDismissed] = useState(null);

  const saved = state?.ok && dismissed !== state;

  if (saved) {
    return (
      <div
        role="status"
        className="flex flex-col gap-3 rounded-lg border border-green-300 p-4 dark:border-green-900"
      >
        <p className="font-medium text-green-800 dark:text-green-400">&#10003; Note saved</p>
        <div className="flex flex-wrap items-center gap-3">
          {back && (
            <Link
              href={back.href}
              className="flex min-h-11 items-center rounded bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              {back.label} &rarr;
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setNote("");
              setRating("");
              setDismissed(state);
            }}
            className="min-h-11 text-sm text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
          >
            Add another note
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      {title && <h2 className="font-medium">{title}</h2>}
      <label className="flex flex-col gap-1 text-sm">
        Note
        <textarea
          name="note"
          required
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <label className="flex max-w-[8rem] flex-col gap-1 text-sm">
          Rating (1–5, optional)
          <input
            name="rating"
            type="number"
            min="1"
            max="5"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tasted on
          {/* Defaults to today, so logging as you drink stays one tap - but a
              bottle you opened last month no longer gets stamped with the day
              you got round to writing it up. */}
          <input
            name="tastedAt"
            type="date"
            value={tastedAt}
            max={today}
            onChange={(event) => setTastedAt(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? <Spinner label="Saving…" /> : "Add tasting note"}
      </button>
    </form>
  );
}
