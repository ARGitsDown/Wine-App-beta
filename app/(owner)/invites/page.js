import { prisma } from "@/lib/prisma";
import { isAuthConfigured, isGoogleConfigured } from "@/lib/auth";
import { currentCellarmaster } from "@/lib/owner";
import { INVITE_ACCESS_VALUES, inviteAccessLabel } from "@/lib/invite-access";
import { cellarDisplayName, founderDisplayName } from "@/lib/cellar-name";
import { monthlyUsage } from "@/lib/usage";
import { changeMemberRole, removeMember, revokeInvite } from "@/app/(owner)/invites/actions";
import InviteForm from "@/app/components/InviteForm";
import DomaineDetailsForm from "@/app/components/DomaineDetailsForm";
import ConfirmButton from "@/app/components/ConfirmButton";
import ShareInviteButton from "@/app/components/ShareInviteButton";
import AiUsageSummary from "@/app/components/AiUsageSummary";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";

function when(date) {
  return new Date(date).toLocaleDateString();
}

// How each member's role reads in the member list.
const ROLE_LABELS = { cellarmaster: "Cellarmaster", guest: "Guest" };

const rowClass =
  "flex flex-col gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm dark:border-zinc-800";
const neutralButton =
  "min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700";
const dangerButton =
  "min-h-11 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400";

// Everything about who can use this Domaine, and what it's called.
//
// Ordered by how often each part is used (BACKLOG #53, finding 5): it
// used to open on "Name your Domaine" and two paragraphs of rules, with
// the invite form below the fold on a phone - so the page you reach from
// "Invite a guest" didn't start with inviting anyone. Now: invite, the
// people involved, and the name last, still its own section so it doesn't
// read as part of the people admin.
//
// Each person appears once (finding 6). Unused invites are "Waiting to
// sign in"; once someone signs in they live under Members, where Remove
// is the control that actually takes access away - a used invite's Revoke
// only stopped *future* sign-ins, sat above Members, and was the one the
// owner reached first. Accepted "separate cellar" invites are the one
// kind of used invite still listed, because nothing else on this page
// represents those people.
export default async function PeoplePage({ searchParams }) {
  const { access } = await searchParams;
  // Only a value the form actually offers; anything else opens unchosen.
  const initialAccess = INVITE_ACCESS_VALUES.has(access) ? access : null;

  // Everything on this page is this Domaine's own: its name, the invites
  // sent from it, and who belongs to it.
  const { id: myId, domaineId } = await currentCellarmaster();
  const [domaine, invites, members, usage] = await Promise.all([
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
    monthlyUsage(domaineId),
  ]);

  const founder = members.find((member) => member.role === "cellarmaster");
  const cellarName = cellarDisplayName(domaine, founder);
  const waiting = invites.filter((invite) => !invite.acceptedAt);
  const ownCellars = invites.filter((invite) => invite.acceptedAt && invite.access === "separate");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <BackButton fallbackHref="/" />

      <div>
        <h1 className="text-2xl font-semibold">People</h1>
        <p className="text-sm text-zinc-500">Only invited addresses can sign in.</p>
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
        <InviteForm
          googleConfigured={isGoogleConfigured()}
          initialAccess={initialAccess}
          cellarName={cellarName}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">
          Waiting to sign in
          {waiting.length > 0 && (
            <span className="ml-2 text-sm font-normal text-zinc-500">{waiting.length}</span>
          )}
        </h2>
        {waiting.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {invites.length === 0
              ? "Nobody yet."
              : "Nobody — everyone you've invited has signed in."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {waiting.map((invite) => (
              <li key={invite.id} className={rowClass}>
                <div className="min-w-0">
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-xs text-zinc-500">
                    {invite.note ? `${invite.note} · ` : ""}
                    {inviteAccessLabel(invite.access)} · invited {when(invite.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Nothing is sent when someone is invited, so this is
                      also how to nudge someone who never turned up. */}
                  <ShareInviteButton
                    email={invite.email}
                    cellarName={cellarName}
                    className={neutralButton}
                  />
                  <ConfirmButton
                    action={revokeInvite.bind(null, invite.id)}
                    label="Revoke"
                    confirmLabel="Yes, revoke"
                    warning={`${invite.email} won't be able to sign in.`}
                    className={dangerButton}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Members</h2>
        {/* Only this Domaine's own members: a separately-invited account
            has its own Domaine and its own list. Your own row has no
            controls - changeMemberRole and removeMember refuse it too -
            which is what guarantees a Domaine always keeps at least one
            Cellarmaster: the person pressing the button. */}
        <ul className="flex flex-col gap-1.5">
          {members.map((member) => {
            const who = member.name || member.email || "Not claimed yet";
            const isMe = member.id === myId;
            const nextRole = member.role === "cellarmaster" ? "guest" : "cellarmaster";
            return (
              <li key={member.id} className={rowClass}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <span className="min-w-0">
                    {/* Their own name if they have one, else their address -
                        never a stand-in like "Cellar owner", which in a
                        shared Domaine would label every unnamed member as
                        the owner. The seeded row before anyone claims it
                        has neither. */}
                    <span className="font-medium">
                      {who}
                      {isMe && " (you)"}
                    </span>
                    {member.name && member.email && (
                      <span className="text-zinc-500">
                        {" — "}
                        {member.email}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </div>
                {!isMe && (
                  <div className="flex flex-wrap items-center gap-2">
                    <ConfirmButton
                      action={changeMemberRole.bind(null, member.id, nextRole)}
                      label={`Make ${ROLE_LABELS[nextRole]}`}
                      confirmLabel={`Yes, make ${ROLE_LABELS[nextRole]}`}
                      tone="neutral"
                      doneMessage={`${who} is now a ${ROLE_LABELS[member.role]}.`}
                      warning={
                        nextRole === "guest"
                          ? `${who} will only be able to browse and favorite - no adding, editing, scanning or Suggest. Takes effect on their next tap.`
                          : `${who} will be able to add, edit and delete anything in this cellar, and invite or remove people.`
                      }
                      className={neutralButton}
                    />
                    <ConfirmButton
                      action={removeMember.bind(null, member.id)}
                      label="Remove"
                      confirmLabel="Yes, remove"
                      warning={`${who}'s account is deleted and they're signed out. Everything they added stays in the cellar. They can only come back if invited again.`}
                      className={dangerButton}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {ownCellars.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-medium">Has their own cellar</h2>
            <p className="text-sm text-zinc-500">
              People you invited to a separate cellar. They see nothing of
              yours.
            </p>
          </div>
          <ul className="flex flex-col gap-1.5">
            {ownCellars.map((invite) => (
              <li key={invite.id} className={rowClass}>
                <div className="min-w-0">
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-xs text-zinc-500">
                    {invite.note ? `${invite.note} · ` : ""}
                    signed in {when(invite.acceptedAt)}
                  </p>
                </div>
                {/* Kept, because this is the only way to stop someone
                    using a cellar that runs on your account - but the
                    warning says plainly what it does to them, which the
                    old wording ("their own cellar is untouched") hid. */}
                <div>
                  <ConfirmButton
                    action={revokeInvite.bind(null, invite.id)}
                    label="Revoke"
                    confirmLabel="Yes, lock them out"
                    warning={`${invite.email} will be locked out of their own cellar at their next sign-in, and nobody else can let them back in. Their wine records stay, but they can't reach them.`}
                    className={dangerButton}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AiUsageSummary status={usage} />

      {/* The Domaine's own setting rather than about people - last,
          because it's set once and rarely touched again. */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-medium">Your Domaine</h2>
          <p className="text-sm text-zinc-500">
            Guests see this at the top of their screen. Left blank, it
            shows as &ldquo;{founderDisplayName(founder)}&apos;s cellar&rdquo;.
          </p>
        </div>
        <DomaineDetailsForm domaineName={domaine?.name} domaineMotto={domaine?.motto} />
      </section>
    </div>
  );
}
