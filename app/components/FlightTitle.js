"use client";

import { useState } from "react";
import { renameFlight } from "@/app/actions";
import { flightName } from "@/lib/flights";

// The heading, editable in place - the same allowance PairingTitle already
// gives a kept pairing, built the same way rather than shared: a flight's
// name is a first guess too, either the model's or the one typed in when
// it was started by hand, and worth being able to overrule once you know
// what the flight actually turned out to be (an event name, say, once it's
// happened). defaultValue reads flightName(), not flight.title directly -
// title is nullable (a hand-built flight can have only a summary), so
// editing starts from whatever is already shown as the name rather than a
// blank box.
export default function FlightTitle({ flight }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-semibold">{flightName(flight)}</h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-zinc-500 underline decoration-dotted underline-offset-2"
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        const result = await renameFlight(flight.id, formData);
        if (result?.error) setError(result.error);
        else setEditing(false);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="title"
          defaultValue={flightName(flight)}
          autoFocus
          maxLength={200}
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-lg dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditing(false);
          }}
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
