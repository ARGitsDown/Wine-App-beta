"use client";

import { useActionState } from "react";
import { setDomaineDetails } from "@/app/(owner)/invites/actions";

const inputClass =
  "min-h-11 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const buttonClass =
  "min-h-11 self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const labelClass = "flex w-full max-w-xs flex-col gap-1 text-sm font-medium";

const initial = { success: false };

// Its own client component for the same reason InviteForm is one: a plain
// server-action form has no way to say "that worked" without a full page
// reload, and a save with no feedback reads as though nothing happened.
//
// Visible labels, not placeholder-only boxes: once both were filled in,
// nothing on screen said which was the name and which the motto (BACKLOG
// #53, finding 5).
export default function DomaineDetailsForm({ domaineName, domaineMotto }) {
  const [state, formAction, pending] = useActionState(setDomaineDetails, initial);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <label className={labelClass}>
        Domaine name
        <input
          name="domaineName"
          defaultValue={domaineName ?? ""}
          placeholder="e.g. Rucker Family Cellar"
          maxLength={120}
          className={`${inputClass} font-normal`}
        />
      </label>
      <label className={labelClass}>
        <span>
          Motto <span className="font-normal text-zinc-500">(optional)</span>
        </span>
        <input
          name="domaineMotto"
          defaultValue={domaineMotto ?? ""}
          placeholder="e.g. Life's too short for bad wine"
          maxLength={200}
          className={`${inputClass} font-normal`}
        />
      </label>
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
