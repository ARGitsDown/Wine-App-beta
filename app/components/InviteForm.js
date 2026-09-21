"use client";

import { useActionState } from "react";
import { inviteSomeone } from "@/app/(owner)/invites/actions";

const initial = { error: null, success: false };

// Its own client component so the form can report a refused address
// ("already invited", "that isn't an email") in place, rather than the
// page having to reload to say so.
export default function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteSomeone, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="their@email.com"
          aria-label="Email address to invite"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="text"
          name="note"
          placeholder="Who is this? (optional)"
          aria-label="A note about who this is"
          className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Invited. They can sign in with that Google address.
        </p>
      )}
      {/* The single most common way this goes wrong, and it is invisible
          from inside the app: Google refuses accounts that are not test
          users while the OAuth consent screen is still in Testing. */}
      <p className="text-xs text-zinc-500">
        While the Google consent screen is in Testing, this address also has
        to be added as a Test user in Google Cloud — otherwise Google turns
        them away before this app ever sees them.
      </p>
    </form>
  );
}
