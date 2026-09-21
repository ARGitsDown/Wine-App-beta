import { prisma } from "@/lib/prisma";
import { isAuthConfigured } from "@/lib/auth";
import { revokeInvite } from "@/app/(owner)/invites/actions";
import InviteForm from "@/app/components/InviteForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

function when(date) {
  return new Date(date).toLocaleDateString();
}

export default async function InvitesPage() {
  const [invites, users] = await Promise.all([
    prisma.invite.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <BackButton fallbackHref="/" />

      <div>
        <h1 className="text-2xl font-semibold">Who can sign in</h1>
        <p className="text-sm text-zinc-500">
          This cellar is invite-only. An address has to be on this list
          before its owner can sign in with Google — there is no open
          registration and no other way in.
        </p>
      </div>

      {/* The list is real and editable whether or not accounts are switched
          on, so invites can be prepared before the door opens rather than
          in a rush afterwards. Saying so is better than a page that looks
          inert for reasons it never explains. */}
      {!isAuthConfigured() && (
        <p className="rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-900">
          Accounts aren&apos;t switched on yet, so nobody can sign in at all
          — including the people below. You can build the list now and it
          will take effect the moment{" "}
          <code className="text-xs">AUTH_GOOGLE_ID</code> and its companions
          are set. See <code className="text-xs">.env.example</code>.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Invite someone</h2>
        <InviteForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Invited
          {invites.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">
              {invites.length}
            </span>
          )}
        </h2>
        {invites.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nobody yet. Until accounts are switched on that changes nothing;
            afterwards it means only you can get in.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-zinc-500">
                    {invite.note ? `${invite.note} · ` : ""}
                    invited {when(invite.createdAt)}
                    {invite.acceptedAt
                      ? ` · signed in ${when(invite.acceptedAt)}`
                      : " · hasn't signed in yet"}
                  </p>
                </div>
                <ConfirmButton
                  action={revokeInvite.bind(null, invite.id)}
                  label="Revoke"
                  confirmLabel="Yes, revoke"
                  warning={
                    invite.acceptedAt
                      ? `${invite.email} can't sign in again after this. They keep any session they already have until it expires or they sign out, and their own cellar is untouched.`
                      : `${invite.email} won't be able to sign in.`
                  }
                  className="shrink-0 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Accounts</h2>
        {/* Deliberately read-only. Deleting a person here would cascade to
            every bottle, flight and pairing they own - which is the correct
            database behaviour and entirely the wrong thing to put behind a
            button on a list page. Revoking an invite is the reversible
            action; removing somebody's cellar should be deliberate enough
            to need a hand on the database. */}
        <ul className="flex flex-col gap-1.5">
          {users.map((user) => (
            <li
              key={user.id}
              className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800"
            >
              <span className="font-medium">{user.name || "Cellar owner"}</span>
              <span className="text-zinc-500">
                {" — "}
                {user.email || "not claimed yet"}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-zinc-500">
          Removing an account would take its whole cellar with it, so it
          isn&apos;t a button here on purpose.
        </p>
      </section>
    </div>
  );
}
