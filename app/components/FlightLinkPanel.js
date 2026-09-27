"use client";

import { useState } from "react";
import ConfirmButton from "@/app/components/ConfirmButton";
import Spinner from "@/app/components/Spinner";

const createButtonClass =
  "min-h-11 self-start rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const flightButtonClass =
  "flex min-h-11 w-full items-center rounded-lg border border-zinc-300 px-3 text-left text-sm disabled:opacity-50 dark:border-zinc-700";
const flightConfirmClass =
  "flex min-h-11 w-full items-center rounded-lg border border-violet-400 px-3 text-left text-sm font-medium text-violet-800 dark:border-violet-700 dark:text-violet-300";

// The one required step for a wine saved under Flight (see the
// Bottle.status comment in prisma/schema.prisma): pick an existing open
// flight, or start a new one. Shared between ScanPanel (a batch just
// finished) and the /flights index's own "waiting for a flight" section
// (a batch that finished earlier and was never resolved, BACKLOG #37/#38)
// rather than two copies of the same picker with two different bugs.
//
// Every control here is 44px and the one-tap "add all N and leave the
// page" choice now asks first - a UX review (2026-09-27) found the
// original version at ~20px with no confirm, the smallest and least
// guarded controls on the one screen a mis-tap is hardest to undo on
// (each removal here is its own trip through FlightPicksList's own
// confirm, one wine at a time).
export default function FlightLinkPanel({
  wines,
  openFlights,
  busy,
  error,
  onAddTo,
  onStartNew,
  suggestedTitle,
  heading,
}) {
  const [title, setTitle] = useState(suggestedTitle || "");

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-violet-300 p-3 dark:border-violet-900">
      <p className="text-sm font-medium text-violet-800 dark:text-violet-400">{heading}</p>
      <p className="text-xs text-zinc-500">{wines.map((w) => w.title).join(", ")}</p>

      {openFlights.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {openFlights.map((flight) => (
            <li key={flight.id}>
              <ConfirmButton
                action={() => onAddTo(flight.id)}
                label={`${flight.name} — add ${wines.length === 1 ? "this wine" : `all ${wines.length}`} here`}
                confirmLabel="Yes, add"
                warning={`Adds ${wines.length === 1 ? "this wine" : `all ${wines.length} wines`} to "${flight.name}" and leaves this page.`}
                className={flightButtonClass}
                confirmClassName={flightConfirmClass}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">No flights on the go. Start one below.</p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onStartNew(title);
        }}
        className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 dark:border-zinc-800"
      >
        <label className="text-xs text-zinc-500">
          {openFlights.length > 0 ? "Or start a new flight" : "Start a new flight"}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Theme name"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button type="submit" disabled={busy} className={createButtonClass}>
          Create and open
        </button>
      </form>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {busy && <Spinner label="Adding…" />}
    </div>
  );
}
