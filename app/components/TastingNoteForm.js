"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { addTastingNote } from "@/app/actions";
import Spinner from "@/app/components/Spinner";
import StarRating from "@/app/components/StarRating";
import AutoTextarea from "@/app/components/AutoTextarea";

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
// The Save button lives in the header, beside the title, tied to the form by
// its `form` attribute - it stays in view at the top of the section instead of
// under the fields. The fields are the note, then the stars and the date on
// one level row. Renders its own header, so the page puts the form where the
// section's heading would be.
//
// `back` is { href, label } or null. The page's own list of notes updates
// underneath (addTastingNote revalidates it).
export default function TastingNoteForm({ bottleId, defaultNote = "", today, back = null, title = "Tasting notes" }) {
  const formId = useId();
  const ratingLabelId = `${formId}-rating`;
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
      <div className="flex flex-col gap-3">
        <h2 className="flex min-h-11 items-center font-medium">{title}</h2>
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
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 className="font-medium">{title}</h2>
        <button
          type="submit"
          form={formId}
          disabled={pending}
          className="min-h-11 rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? <Spinner label="Saving…" /> : "Save note"}
        </button>
      </div>
      <form
        id={formId}
        action={formAction}
        className="flex flex-col gap-2.5 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
      >
        {/* No "Note" label: the heading above is "Tasting notes" and the
            placeholder says what goes here, which buys back a line. The
            box opens at two rows and grows with what is typed. */}
        <AutoTextarea
          name="note"
          required
          minRows={2}
          maxHeight={240}
          aria-label="Tasting note"
          placeholder="What did you think?"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 flex-col gap-1 text-sm">
            <span id={ratingLabelId}>Rating (opt.)</span>
            <StarRating value={rating} onChange={setRating} labelledBy={ratingLabelId} />
          </div>
          <label className="flex min-w-0 flex-col gap-1 text-sm">
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
              className={`${inputClass} h-11 w-full min-w-0`}
            />
          </label>
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
