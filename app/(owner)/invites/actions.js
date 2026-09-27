"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/invite-policy";
import { INVITE_ACCESS_VALUES } from "@/lib/invite-access";
import { currentCellarmaster, currentDomaineId } from "@/lib/owner";

// The invite list is the whole of "invite-only", so two of these actions
// are the only way into this app and the only way to close it again; the
// third (setDomaineDetails) is unrelated to the door but is the other
// thing this page is for - account-level, not wine, which is why all
// three are kept beside the page they serve rather than in
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
  return { success: true, access };
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
