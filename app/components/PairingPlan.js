"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { planPairing, clearPairingPlan } from "@/app/actions";
import Spinner from "@/app/components/Spinner";
import { localDayInputValue } from "@/lib/tasting-date";

const buttonClass =
  "min-h-11 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700";
const linkButtonClass =
  "flex min-h-11 items-center text-sm text-zinc-600 underline underline-offset-2 disabled:opacity-50 dark:text-zinc-400";

// Planning a pairing for a day, and finishing it.
//
// Unplanned: "Drink tonight" (one tap, the reader's own today) and, on the
// detail page, "Pick a day". Planned: "Clear day", which removes the plan,
// and on the detail page "Change day". Clearing says what it did and offers
// Undo for a few seconds, which puts the same day back: the row moves in the
// list the moment the plan goes, and an accidental tap should not be final. Nothing here ever clears a plan by itself - see
// the schema comment on SavedPairing.plannedFor.
//
// `compact` is the list row: just the one button, since the row is for
// finding and glancing, and the day is on the badge beside the title.
//
// The day is chosen here, in the browser, because "tonight" is the reader's
// own date and the server (UTC) cannot know it.
export default function PairingPlan({ pairingId, plannedDay = null, compact = false }) {
  const planned = Boolean(plannedDay);
  const [pending, startTransition] = useTransition();
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState("");
  const [error, setError] = useState(null);
  // The day that was just cleared, kept briefly so Undo can put it back.
  const [cleared, setCleared] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function run(task) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result?.error) setError(result.error);
      else setPicking(false);
    });
  }

  const tonight = () => run(() => planPairing(pairingId, localDayInputValue()));
  const clearDay = () => {
    const previous = plannedDay;
    run(async () => {
      const result = await clearPairingPlan(pairingId);
      if (!result?.error) {
        setCleared(previous);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCleared(null), 6000);
      }
      return result;
    });
  };
  const undo = () => {
    const previous = cleared;
    setCleared(null);
    run(() => planPairing(pairingId, previous));
  };

  if (picking) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (day) run(() => planPairing(pairingId, day));
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="sr-only">Day</span>
          <input
            type="date"
            value={day}
            min={localDayInputValue()}
            onChange={(event) => setDay(event.target.value)}
            required
            autoFocus
            className="h-11 rounded border border-zinc-300 px-2 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !day}
          className="min-h-11 rounded bg-zinc-900 px-4 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? <Spinner label="Saving…" /> : "Save"}
        </button>
        <button type="button" onClick={() => setPicking(false)} className={linkButtonClass}>
          Cancel
        </button>
        {error && (
          <p role="alert" className="basis-full text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {planned ? (
        <button type="button" onClick={clearDay} disabled={pending} className={buttonClass}>
          Clear day
        </button>
      ) : (
        <button type="button" onClick={tonight} disabled={pending} className={buttonClass}>
          Drink tonight
        </button>
      )}
      {!compact && (
        <button
          type="button"
          onClick={() => {
            // Starts on the day already planned (nudging Saturday to Sunday
            // should not mean scrolling a picker from today), or today when
            // that day has passed and the date input would refuse it.
            const today = localDayInputValue();
            setDay(plannedDay && plannedDay >= today ? plannedDay : today);
            setPicking(true);
          }}
          disabled={pending}
          className={linkButtonClass}
        >
          {planned ? "Change day" : "Pick a day"}
        </button>
      )}
      {pending && <Spinner label="Saving…" />}
      {cleared && !planned && (
        <span role="status" className="flex basis-full items-center gap-2 text-sm text-zinc-500">
          Day cleared
          <button type="button" onClick={undo} disabled={pending} className={linkButtonClass}>
            Undo
          </button>
        </span>
      )}
      {error && (
        <span role="alert" className="basis-full text-sm text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
