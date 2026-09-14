"use client";

import { useActionState } from "react";
import { createFlight } from "@/app/actions";
import Spinner from "@/app/components/Spinner";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default function NewFlightForm() {
  const [state, formAction, pending] = useActionState(createFlight, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Theme name
        <input
          name="title"
          required
          maxLength={120}
          placeholder="e.g. The Many Faces of Pinot"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What the theme is (optional)
        <textarea
          name="summary"
          rows={2}
          placeholder="Why these wines, and why in this order — shown under the name."
          className={inputClass}
        />
      </label>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? <Spinner label="Creating…" /> : "Create flight"}
      </button>
      {/* Creating lands you on the flight's own page, which is where the
          bottles get added - so this form only ever asks for the two things
          a flight can't be built without. */}
      <p className="text-xs text-zinc-500">
        You&apos;ll pick the bottles on the next screen.
      </p>
    </form>
  );
}
