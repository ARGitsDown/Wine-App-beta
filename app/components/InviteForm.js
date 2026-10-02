"use client";

import { useActionState } from "react";
import { inviteSomeone } from "@/app/(owner)/invites/actions";
import { SEPARATE_OPTION, SHARING_OPTIONS, inviteAccessLabel } from "@/lib/invite-access";
import ShareInviteButton from "@/app/components/ShareInviteButton";

const initial = { error: null, success: false };

const optionClass =
  "flex min-h-11 cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-zinc-900 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-zinc-900 dark:border-zinc-800 dark:has-[:checked]:border-zinc-100 dark:has-[:focus-visible]:outline-zinc-100";

function AccessOption({ option, initialAccess }) {
  return (
    <label className={optionClass}>
      <input
        type="radio"
        name="access"
        value={option.value}
        required
        defaultChecked={option.value === initialAccess}
        className="mt-0.5"
      />
      <span>
        <span className="font-medium">{option.label}</span>
        <span className="block text-xs text-zinc-500">{option.description}</span>
      </span>
    </label>
  );
}

// Its own client component so the form can report a refused address
// ("already invited", "that isn't an email") in place, rather than the
// page having to reload to say so.
//
// Nothing is preselected unless the link that opened the page asked for
// something (`initialAccess`, from /invites?access=guest - the Cellar
// page's "Invite a guest"). It used to preselect Cellarmaster, which made
// "Invite a guest" -> type an email -> Invite hand a friend full edit
// access (BACKLOG #53, finding 1). The riskier choice is never the one you
// get by not choosing; an unchosen form is refused in place instead.
export default function InviteForm({ googleConfigured, initialAccess, cellarName }) {
  const [state, formAction, pending] = useActionState(inviteSomeone, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          name="email"
          required
          placeholder="their@email.com"
          aria-label="Email address to invite"
          className="min-h-11 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <input
          type="text"
          name="note"
          placeholder="Who is this? (optional)"
          aria-label="A note about who this is"
          className="min-h-11 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium">What can they do in your cellar?</legend>
        {SHARING_OPTIONS.map((option) => (
          <AccessOption key={option.value} option={option} initialAccess={initialAccess} />
        ))}
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Or, not sharing
        </p>
        <AccessOption option={SEPARATE_OPTION} initialAccess={initialAccess} />
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Inviting…" : "Invite"}
      </button>

      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      {/* "They can sign in now" was true and misleading: nothing is sent,
          so an invite the owner doesn't pass on is never seen. Says so,
          and hands them the message to send. */}
      {state?.success && (
        <div role="status" className="flex flex-col items-start gap-2 text-sm">
          <p className="text-green-700 dark:text-green-400">
            {state.access === "separate"
              ? "Invited. They'll get a cellar of their own when they first sign in."
              : `Invited as a ${inviteAccessLabel(state.access)}.`}{" "}
            <span className="text-zinc-600 dark:text-zinc-400">
              Cellarmaster doesn&apos;t send anything — let them know.
            </span>
          </p>
          <ShareInviteButton email={state.email} cellarName={cellarName} />
        </div>
      )}
      {/* Google-specific, so only shown when Google is actually a door
          someone might use - a caveat about a screen this address will
          never see is just noise on an email-only setup. The single most
          common way the Google side goes wrong, and it is invisible from
          inside this app: Google refuses accounts that are not test users
          while the OAuth consent screen is still in Testing. */}
      {googleConfigured && (
        <p className="text-xs text-zinc-500">
          If they&apos;ll sign in with Google: while the consent screen is
          in Testing, this address also has to be added as a Test user in
          Google Cloud — otherwise Google turns them away before this app
          ever sees them.
        </p>
      )}
    </form>
  );
}
