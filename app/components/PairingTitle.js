"use client";

import { useRef, useState } from "react";
import { renamePairing } from "@/app/actions";

// The heading, editable in place. The whole of "allow modification" on a
// kept pairing: the request, the settings and the wines are the record of
// what happened and stay as they were, but the model's title is a first
// guess at what you would call it, and a first guess is worth being able
// to overrule.
//
// Same click-to-edit shape as InlineDateEditor, for the same reason - the
// value is right most of the time, so it reads as text until you say
// otherwise.
export default function PairingTitle({ pairing }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  if (!editing) {
    return (
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-2xl font-semibold">{pairing.title}</h1>
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
        const result = await renamePairing(pairing.id, formData);
        if (result?.error) setError(result.error);
        else setEditing(false);
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          name="title"
          defaultValue={pairing.title}
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
