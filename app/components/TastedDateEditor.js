"use client";

import { useState } from "react";
import { updateTastingNoteDate } from "@/app/actions";
import { formatTastedDate, toDateInputValue, todayInputValue } from "@/lib/tasting-date";

// The date on an existing note, editable in place. Notes written before
// this existed were all stamped with whenever they were typed up rather
// than when the bottle was actually opened, so being able to correct one
// matters as much as setting it correctly the first time.
export default function TastedDateEditor({ note }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Change this date"
        className="underline decoration-dotted underline-offset-2"
      >
        {formatTastedDate(note.tastedAt)}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        const result = await updateTastingNoteDate(note.id, formData);
        if (result?.error) setError(result.error);
        else setEditing(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        type="date"
        name="tastedAt"
        required
        defaultValue={toDateInputValue(note.tastedAt)}
        max={todayInputValue()}
        className="rounded border border-zinc-300 px-1.5 py-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button type="submit" className="text-xs underline underline-offset-2">
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setError(null);
        }}
        className="text-xs text-zinc-500 underline underline-offset-2"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </form>
  );
}
