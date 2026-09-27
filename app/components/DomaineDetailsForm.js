"use client";

import { useActionState } from "react";
import { setDomaineDetails } from "@/app/(owner)/invites/actions";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const buttonClass =
  "self-start rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

const initial = { success: false };

// Its own client component for the same reason InviteForm is one: a plain
// server-action form has no way to say "that worked" without a full page
// reload, and a save with no feedback reads as though nothing happened.
export default function DomaineDetailsForm({ domaineName, domaineMotto }) {
  const [state, formAction, pending] = useActionState(setDomaineDetails, initial);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input
        name="domaineName"
        defaultValue={domaineName ?? ""}
        placeholder="e.g. Rucker Family Cellar"
        maxLength={120}
        className={`${inputClass} w-full max-w-xs`}
      />
      <input
        name="domaineMotto"
        defaultValue={domaineMotto ?? ""}
        placeholder="A motto (optional) - e.g. Life's too short for bad wine"
        maxLength={200}
        className={`${inputClass} w-full max-w-xs`}
      />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.success && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          ✓ Saved
        </p>
      )}
    </form>
  );
}
