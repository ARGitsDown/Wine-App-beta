import { prisma } from "@/lib/prisma";
import { isAuthConfigured, isGoogleConfigured } from "@/lib/auth";
import { currentOwnerId } from "@/lib/owner";
import { revokeInvite, setDomaineDetails } from "@/app/(owner)/invites/actions";
import InviteForm from "@/app/components/InviteForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const buttonClass =
  "self-start rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900";

function when(date) {
  return new Date(date).toLocaleDateString();
}

export default async function InvitesPage() {
  const ownerId = await currentOwnerId();
  const [me, invites, users] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { domaineName: true, domaineMotto: true },
    }),
    prisma.invite.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        domaineName: true,
        domaineMotto: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <BackButton fallbackHref="/" />

      {/* Your own setting, not an admin one - unlike everything else on
          this page, which is about who else can get in. Above that
          content rather than mixed into it, so the two don't read as one
          category of thing. */}
      <section className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Name your Domaine</h1>
          <p className="text-sm text-zinc-500">
            The estate&apos;s own name - distinct from your own name, which
            still shows wherever this app says who you are. Blank uses
            your name instead, wherever this would otherwise appear (right
            now, just the guest sign-in screen). A motto only ever shows
            alongside the name, never on its own.
          </p>
        </div>
        <form action={setDomaineDetails} className="flex flex-col items-start gap-2">
          <input
            name="domaineName"
            defaultValue={me?.domaineName ?? ""}
            placeholder="e.g. Rucker Family Cellar"
            maxLength={120}
            className={`${inputClass} w-full max-w-xs`}
          />
          <input
            name="domaineMotto"
            defaultValue={me?.domaineMotto ?? ""}
            placeholder="A motto (optional) - e.g. Life's too short for bad wine"
            maxLength={200}
            className={`${inputClass} w-full max-w-xs`}
          />
          <button type="submit" className={buttonClass}>
            Save
          </button>
        </form>
      </section>

      <div>
        <h2 className="font-medium">Who can sign in</h2>
        <p className="text-sm text-zinc-500">
          This cellar is invite-only. An address has to be on this list
          before it can sign in, whether with Google or by email link —
          there is no open registration and no other way in.
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
          will take effect the moment a sign-in door is set up — Google or
          email, see <code className="text-xs">.env.example</code>.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Invite someone</h2>
        <InviteForm googleConfigured={isGoogleConfigured()} />
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
              {/* Each account is already its own fully separate cellar
                  today (see the "Separate cellars per user" decision in
                  FUTURE_CAPABILITIES.md), so this is that account's own
                  estate name, not a shared one - two rows here can carry
                  two different Domaine names, correctly. The motto never
                  renders without the name (see the page's own intro
                  text) - a tagline with nothing to sit under wouldn't
                  mean anything. */}
              {user.domaineName && (
                <span className="block text-xs text-zinc-400">
                  {user.domaineName}
                  {user.domaineMotto && ` — "${user.domaineMotto}"`}
                </span>
              )}
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
