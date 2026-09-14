"use client";

import { useRef, useState } from "react";
import { formatTastedDate, toDateInputValue, todayInputValue } from "@/lib/tasting-date";

// A date shown as text until you click it, then an input with Save/Cancel.
// Used for both a tasting note's date and a bottle's emptied date: in each
// case the stored value is a standing guess ("now", at the moment you
// pressed a button) that's right when you log as you go and wrong whenever
// you're catching up afterward.
//
// `action` is a bound Server Action taking a FormData with `name`; the
// caller owns which field that is so one component serves both.
//
// `clearable` offers a Clear button and submits an empty value for it. Only
// the acquired date wants this: an emptied date is implied by the row being
// in History at all, but a bottle can legitimately have no acquisition date
// (see acquiredAtForStatus), so removing a wrong one has to be possible.
export default function InlineDateEditor({
  date,
  action,
  name,
  emptyLabel = "Set a date",
  title = "Change this date",
  clearable = false,
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        title={title}
        className={
          date
            ? "underline decoration-dotted underline-offset-2"
            : "italic underline decoration-dotted underline-offset-2"
        }
      >
        {date ? formatTastedDate(date) : emptyLabel}
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        const result = await action(formData);
        if (result?.error) setError(result.error);
        else setEditing(false);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        ref={inputRef}
        type="date"
        name={name}
        required={!clearable}
        // A row with no date yet opens on today rather than blank, since
        // that's the likeliest answer and saves a tap.
        defaultValue={date ? toDateInputValue(date) : todayInputValue()}
        max={todayInputValue()}
        className="rounded border border-zinc-300 px-1.5 py-0.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button type="submit" className="text-xs underline underline-offset-2">
        Save
      </button>
      {clearable && date && (
        // Empties the field and lets the normal submit carry "" through, so
        // clearing goes down the same path as saving rather than needing an
        // action of its own.
        <button
          type="submit"
          onClick={() => {
            if (inputRef.current) inputRef.current.value = "";
          }}
          className="text-xs text-zinc-500 underline underline-offset-2"
        >
          Clear
        </button>
      )}
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
