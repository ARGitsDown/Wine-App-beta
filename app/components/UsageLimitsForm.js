"use client";

import { useActionState } from "react";
import { setDomaineLimits } from "@/app/(owner)/usage/actions";

const initial = { error: null, success: false, typed: null };

const inputClass =
  "min-h-11 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

// One Domaine's two limits, in dollars. Blank means no limit of that kind,
// which the placeholder says rather than leaving to be guessed - an empty
// money field could as easily mean "zero".
//
// After a refused save the fields keep what was typed (`state.typed`),
// because React resets an uncontrolled form to its defaultValue once the
// action ends - and the default is the saved limit, so a refusal would
// otherwise silently put the old numbers back under the owner's error.
export default function UsageLimitsForm({ domaineId, capCents, hardStopCents }) {
  const [state, formAction, pending] = useActionState(
    setDomaineLimits.bind(null, domaineId),
    initial
  );
  const dollars = (cents) => (cents == null ? "" : (cents / 100).toFixed(2));

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          Monthly cap ($)
          <input
            name="cap"
            inputMode="decimal"
            defaultValue={state?.typed?.cap ?? dollars(capCents)}
            placeholder="No limit"
            className={`${inputClass} font-normal`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Hard stop ($)
          <input
            name="hardStop"
            inputMode="decimal"
            defaultValue={state?.typed?.hardStop ?? dollars(hardStopCents)}
            placeholder="No limit"
            className={`${inputClass} font-normal`}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Saving…" : "Save limits"}
        </button>
        {state?.success && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            ✓ Saved
          </p>
        )}
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}
