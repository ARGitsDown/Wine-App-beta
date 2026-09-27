import { prisma } from "@/lib/prisma";
import { isAuthConfigured, isGoogleConfigured } from "@/lib/auth";
import { currentCellarmaster } from "@/lib/owner";
import { inviteAccessLabel } from "@/lib/invite-access";
import { revokeInvite } from "@/app/(owner)/invites/actions";
import InviteForm from "@/app/components/InviteForm";
import DomaineDetailsForm from "@/app/components/DomaineDetailsForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

function when(date) {
  return new Date(date).toLocaleDateString();
}

// How each member's role reads in the member list.
const ROLE_LABELS = { cellarmaster: "Cellarmaster", guest: "Guest" };

export default async function InvitesPage() {
  // Everything on this page is this Domaine's own: its name, the invites
  // sent from it, and who belongs to it. Another Domaine's invites and
  // members are none of its business, and were only ever listed together
  // because before Domaines could be shared there was one list for the
  // one door.
  const { id: myId, domaineId } = await currentCellarmaster();
  const [domaine, invites, members] = await Promise.all([
    prisma.domaine.findUnique({
      where: { id: domaineId },
      select: { name: true, motto: true },
    }),
    prisma.invite.findMany({ where: { domaineId }, orderBy: { createdAt: "desc" } }),
    prisma.user.findMany({
      where: { domaineId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);
  const myEmail = members.find((member) => member.id === myId)?.email;

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
            The estate&apos;s own name - shared by everyone in it, and
            distinct from your own name, which still shows wherever this
            app says who you are. Blank uses the founding Cellarmaster&apos;s
            name instead, wherever this would otherwise appear (right now,
            just the guest screens). A motto only ever shows alongside the
            name, never on its own.
          </p>
        </div>
        <DomaineDetailsForm domaineName={domaine?.name} domaineMotto={domaine?.motto} />
      </section>

      <div>
        <h2 className="font-medium">Who can sign in</h2>
        <p className="text-sm text-zinc-500">
          This cellar is invite-only. An address has to be invited before
          it can sign in, whether with Google or by email link — there is
          no open registration and no other way in. What an invite gives
          them is settled the first time they sign in.
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
                    {inviteAccessLabel(invite.access)} · invited {when(invite.createdAt)}
                    {invite.acceptedAt
                      ? ` · signed in ${when(invite.acceptedAt)}`
                      : " · hasn't signed in yet"}
                  </p>
                </div>
                {/* Never on your own invite - revokeInvite refuses it
                    too, since it would lock you out of your own cellar. */}
                {invite.email === myEmail ? (
                  <span className="shrink-0 text-xs text-zinc-500">You</span>
                ) : (
                  <ConfirmButton
                    action={revokeInvite.bind(null, invite.id)}
                    label="Revoke"
                    confirmLabel="Yes, revoke"
                    warning={
                      invite.acceptedAt
                        ? `${invite.email} can't sign in again after this. They keep any session they already have until it expires or they sign out${invite.access === "separate" ? ", and their own cellar is untouched." : "."}`
                        : `${invite.email} won't be able to sign in.`
                    }
                    className="shrink-0 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Members</h2>
        {/* Deliberately read-only. Removing a member is safe for the
            cellar itself (it belongs to the Domaine; see Bottle.ownerId),
            but a button that deletes a person's account belongs behind
            more thought than a list row. Revoking an invite is the
            reversible action. Only this Domaine's own members: a
            separately-invited account has its own Domaine and its own
            list. */}
        <ul className="flex flex-col gap-1.5">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-baseline justify-between gap-x-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800"
            >
              <span className="min-w-0">
                {/* Their own name if they have one, else their address -
                    never a stand-in like "Cellar owner", which in a
                    shared Domaine would label every unnamed member as
                    the owner. The seeded row before anyone claims it has
                    neither. */}
                <span className="font-medium">
                  {member.name || member.email || "Not claimed yet"}
                  {member.id === myId && " (you)"}
                </span>
                {member.name && member.email && (
                  <span className="text-zinc-500">
                    {" — "}
                    {member.email}
                  </span>
                )}
              </span>
              <span className="text-xs text-zinc-500">{ROLE_LABELS[member.role] ?? member.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
