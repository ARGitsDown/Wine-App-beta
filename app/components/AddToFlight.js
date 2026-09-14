"use client";

import { useState, useTransition } from "react";
import { addBottleToFlight, createFlight } from "@/app/actions";
import Spinner from "@/app/components/Spinner";

// Adds a bottle to a flight from wherever the bottle happens to be shown,
// so a flight can be assembled while browsing rather than only from the
// flight's own page.
//
// Every choice saves immediately. The alternative - collecting bottles into
// a draft and naming it at the end - is the nicer flow but needs somewhere
// to hold a draft that survives a reload and doesn't leak between devices,
// which is a decision worth making on its own rather than smuggling in
// here.
export default function AddToFlight({ bottleId, flights }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(null);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function add(flightId) {
    setError(null);
    startTransition(async () => {
      const result = await addBottleToFlight(flightId, bottleId);
      if (result?.error) {
        setError(result.error);
      } else {
        setAdded(result.data.flightName);
        setOpen(false);
      }
    });
  }

  if (added) {
    return (
      <p className="text-sm font-medium text-green-700 dark:text-green-400">
        ✓ Added to {added}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
      >
        Add to a tasting
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-200 p-2 dark:border-zinc-800">
      {flights.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {flights.map((flight) => (
            <li key={flight.id}>
              <button
                type="button"
                onClick={() => add(flight.id)}
                disabled={pending}
                className="text-left text-sm underline underline-offset-2 disabled:opacity-50"
              >
                {flight.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">
          No flights on the go. Start one below.
        </p>
      )}

      {/* Creating from here redirects to the new flight's page, which is
          where you'd add the rest of its bottles anyway - so this bottle is
          added there rather than being silently attached on the way. */}
      <form action={createFlight} className="flex flex-col gap-1.5 border-t border-zinc-200 pt-2 dark:border-zinc-800">
        <label className="text-xs text-zinc-500">
          Or start a new flight
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Theme name"
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="self-start rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
        >
          Create and open
        </button>
      </form>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-500 underline underline-offset-2"
        >
          Close
        </button>
        {pending && <Spinner label="Adding…" />}
      </div>
    </div>
  );
}
