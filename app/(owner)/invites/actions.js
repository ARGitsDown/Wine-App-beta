"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/invite-policy";
import { INVITE_ACCESS_VALUES } from "@/lib/invite-access";
import { ROLE, ROLE_VALUES } from "@/lib/roles";
import { currentCellarmaster, currentDomaineId } from "@/lib/owner";
import { isDigestFrequency } from "@/lib/digest";

// The invite list is the whole of "invite-only", so inviteSomeone and
// revokeInvite are the only way into this app and the only way to close
// it again; changeMemberRole and removeMember manage who is already
// inside; setDomaineDetails names the place. All account-level, not wine,
// which is why they're kept beside the page they serve rather than in
// app/actions.js.

export async function inviteSomeone(prevState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;
  // Checked here rather than trusted from the form, since a value outside
  // the list would reach createUser in lib/auth.js as an unknown role.
  const access = String(formData.get("access") || "");
  if (!INVITE_ACCESS_VALUES.has(access)) return { error: "Choose what they'll be able to do." };

  // Deliberately shallow: an address either has an @ and something either
  // side or it does not. Anything stricter rejects real addresses, and the
  // real check happens when Google refuses to authenticate a nonexistent
  // account anyway.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "That doesn't look like an email address." };
  }

  const existing = await prisma.invite.findUnique({ where: { email } });
  if (existing) return { error: "That address is already invited." };

  // Sent from the inviter's own Domaine: that's whose list it appears on,
  // who can revoke it, and - unless it's "separate" - which cellar the
  // new account joins.
  const domaineId = await currentDomaineId();
  await prisma.invite.create({ data: { email, note, access, domaineId } });
  revalidatePath("/invites");
  return { success: true, access, email };
}

// Removing an invite shuts the door on the next request rather than
// whenever a token would have expired, because sessions are database-backed
// - but only for someone who has not signed in yet. Someone already inside
// keeps their session until it expires or they sign out, which is why the
// page says so rather than implying otherwise.
//
// Only this Domaine's own invites: the id arrives as plain data a caller
// controls, and every Domaine's Cellarmasters can reach this action. And
// never your own - the one revoke that locks the person pressing it out
// of their own cellar with nobody else guaranteed to let them back in.
export async function revokeInvite(id) {
  const me = await currentCellarmaster();
  const mine = await prisma.user.findUnique({ where: { id: me.id }, select: { email: true } });
  await prisma.invite.deleteMany({
    where: {
      id,
      domaineId: me.domaineId,
      ...(mine?.email ? { NOT: { email: mine.email } } : {}),
    },
  });
  revalidatePath("/invites");
}

// Both member actions below share two rules, enforced in the query itself
// rather than checked first and trusted after:
//   - Only a member of your own Domaine. The id arrives as plain data a
//     caller controls, and every Domaine's Cellarmasters can reach these.
//   - Never yourself. Which also means a Domaine can never be left with no
//     Cellarmaster at all: whoever is acting is one, and stays one. The
//     page doesn't offer either on your own row; this is what makes that
//     more than a missing button.

// Runs `work` in one transaction, and refuses - rolls everything back - if
// the Domaine would be left with no Cellarmaster. Returns whether it went
// through.
//
// Excluding yourself in the query already keeps the person pressing the
// button, but that is a read followed by a write: two Cellarmasters
// removing (or demoting) each other at the same moment would each see the
// other still there, and both succeed. Serializable makes the second
// commit fail instead, and a refused request is the right answer to
// "two people clicked at once".
async function keepingACellarmaster(domaineId, work) {
  try {
    await prisma.$transaction(
      async (tx) => {
        await work(tx);
        const left = await tx.user.count({ where: { domaineId, role: ROLE.CELLARMASTER } });
        if (left === 0) throw new LastCellarmasterError();
      },
      { isolationLevel: "Serializable" }
    );
    return true;
  } catch (err) {
    // P2034: the other of two concurrent changes won. Either way: refused.
    if (err instanceof LastCellarmasterError || err?.code === "P2034") return false;
    throw err;
  }
}

class LastCellarmasterError extends Error {}

// The people these two actions may act on: this Domaine's own members,
// never yourself, and never the account that runs the app (User.isAppOwner)
// - removing or demoting that one would leave the app with nobody who can
// see or set anyone's AI limits, and it is the one account the app must
// never be able to lose. The page shows no controls on either row; this is
// what makes that more than a missing button.
function actionableMember(memberId, me) {
  return {
    id: memberId,
    domaineId: me.domaineId,
    NOT: { id: me.id },
    isAppOwner: false,
  };
}

// Makes a member a Cellarmaster or a Guest. Takes effect on their very
// next request - database sessions re-read the User row every time (see
// the session callback in lib/auth.js) - so a new Guest is on /guest the
// next time they tap anything, and lib/scoped-prisma.js refuses them in
// the meantime. Their invite's access is kept in step, so the Invited
// list keeps saying what that person actually has, not what they had on
// day one. Their favorites identity (a Guest row) survives either way.
export async function changeMemberRole(memberId, role) {
  if (!ROLE_VALUES.has(role)) return;
  const me = await currentCellarmaster();
  const where = actionableMember(memberId, me);
  const member = await prisma.user.findFirst({ where, select: { id: true, email: true } });
  if (!member) return;

  await keepingACellarmaster(me.domaineId, async (tx) => {
    await tx.user.updateMany({ where, data: { role } });
    if (member.email) {
      await tx.invite.updateMany({
        where: { email: member.email, domaineId: me.domaineId },
        data: { access: role },
      });
    }
  });
  revalidatePath("/invites");
}

// Removes a member from the Domaine - which, with one Domaine per User,
// means deleting their account. Their sessions go with it (cascade), so
// they're signed out on their next request rather than whenever a
// session would have expired; their invite goes too, in the same
// transaction, or their next sign-in would simply recreate the account
// and walk them back in. What they added to the cellar stays: it belongs
// to the Domaine, and only its "added by" (ownerId) is cleared - see
// Bottle.ownerId. Their own favorites, as a Guest, go with them.
// Re-inviting the same address later works like any new invite.
export async function removeMember(memberId) {
  const me = await currentCellarmaster();
  const where = actionableMember(memberId, me);
  const member = await prisma.user.findFirst({ where, select: { id: true, email: true } });
  if (!member) return;

  await keepingACellarmaster(me.domaineId, async (tx) => {
    if (member.email) {
      await tx.invite.deleteMany({ where: { email: member.email, domaineId: me.domaineId } });
    }
    await tx.user.deleteMany({ where });
  });
  revalidatePath("/invites");
}

// "Name your Domaine" (and give it a motto) - the estate's own name and
// tagline, as distinct from the person's own `name` (see the schema
// comments on Domaine.name/motto). One action for both fields since
// they're one form - a motto with no name to sit under wouldn't mean
// much, so there's no reason to save them separately. Never takes an id:
// this always writes the signed-in account's own Domaine via
// currentDomaineId(), the same account this whole page is otherwise
// silent about which one "you" are - so there is nothing here for one
// account to aim at another's Domaine with. Blank clears a field back to
// unset rather than leaving an empty string on file, which would render
// identically but read as "set to nothing" instead of "never set."
//
// Any Cellarmaster of the Domaine can rename it - it's theirs as much as
// anyone's, the same as the cellar itself. currentDomaineId refuses a
// guest-role member.
export async function setDomaineDetails(prevState, formData) {
  const name = String(formData.get("domaineName") || "").trim();
  const motto = String(formData.get("domaineMotto") || "").trim();
  const domaineId = await currentDomaineId();
  await prisma.domaine.update({
    where: { id: domaineId },
    data: { name: name || null, motto: motto || null },
  });
  revalidatePath("/invites");
  revalidatePath("/guest");
  return { success: true };
}

// Your own cellar-digest choice (see app/api/digest/route.js). Off, weekly or
// monthly; anything else is refused rather than stored. Changing it does not
// reset when the last one went out, so switching weekly <-> monthly never
// sends a second digest straight away.
export async function setDigestFrequency(frequency) {
  const member = await currentCellarmaster();
  const value = frequency === "" || frequency === null ? null : String(frequency);
  if (value !== null && !isDigestFrequency(value)) return { error: "Choose off, weekly or monthly." };
  await prisma.user.update({ where: { id: member.id }, data: { digestFrequency: value } });
  revalidatePath("/invites");
  return { ok: true };
}
