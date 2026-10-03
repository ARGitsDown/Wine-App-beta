"use client";

import { useActionState, useState } from "react";
import Spinner from "@/app/components/Spinner";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1.5 text-base dark:border-zinc-700 dark:bg-zinc-900";

// One saved tasting note on the wine page: its date (passed in as children, so
// the page keeps owning the date editor), the rating and the text. Read mode
// until "Edit", then the text and rating as fields with Save/Cancel.
//
// `startEditing` is for arriving from the "Note" pill on a flight row: the
// note is already open, fields filled, so it can be read where it sits and
// changed with a tap. Not auto-focused - on a phone that would raise the
// keyboard over the very text the person came to read.
//
// `action` is updateTastingNote bound to this note's id.
export default function TastingNoteBody({ note: savedNote, rating: savedRating, action, startEditing = false, children }) {
  const [editing, setEditing] = useState(startEditing);
  // What read mode shows. A save closes the form before the page's refreshed
  // props arrive, so it is set from what was just saved - otherwise the old
  // text flashes back for a moment and looks like the save failed.
  const [shown, setShown] = useState({ note: savedNote, rating: savedRating });
  const { note, rating } = shown;
  const [text, setText] = useState(note);
  const [stars, setStars] = useState(rating == null ? "" : String(rating));

  const [state, formAction, pending] = useActionState(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result?.ok) {
      const n = Number(formData.get("rating"));
      setShown({
        note: String(formData.get("note")).trim(),
        rating: Number.isInteger(n) && n >= 1 && n <= 5 ? n : null,
      });
      setEditing(false);
    }
    return result;
  }, null);

  if (!editing) {
    return (
      <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
          {children}
          <span className="flex items-center gap-3">
            <span>{rating !== null ? `${rating} / 5 ★` : "No rating"}</span>
            <button
              type="button"
              onClick={() => {
                setText(note);
                setStars(rating == null ? "" : String(rating));
                setEditing(true);
              }}
              className="flex min-h-11 items-center px-1 text-sky-700 underline underline-offset-2 dark:text-sky-300"
            >
              Edit<span className="sr-only"> this tasting note</span>
            </button>
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap">{note}</p>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
        {children}
      </div>
      <form action={formAction} className="mt-2 flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Note
          <textarea
            name="note"
            required
            rows={4}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex max-w-[8rem] flex-col gap-1 text-sm">
          Rating (1–5, optional)
          <input
            name="rating"
            type="number"
            min="1"
            max="5"
            value={stars}
            onChange={(event) => setStars(event.target.value)}
            className={inputClass}
          />
        </label>
        {state?.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? <Spinner label="Saving…" /> : "Save note"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setEditing(false)}
            className="min-h-11 text-sm text-zinc-600 underline underline-offset-2 dark:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
