"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/invite-policy";
import { currentOwnerId } from "@/lib/owner";

// The invite list is the whole of "invite-only", so two of these actions
// are the only way into this app and the only way to close it again; the
// third (setDomaineName) is unrelated to the door but is the other thing
// this page is for - account-level, not wine, which is why all three are
// kept beside the page they serve rather than in app/actions.js.

export async function inviteSomeone(prevState, formData) {
  const email = normalizeEmail(formData.get("email"));
  const note = String(formData.get("note") || "").trim().slice(0, 200) || null;

  // Deliberately shallow: an address either has an @ and something either
  // side or it does not. Anything stricter rejects real addresses, and the
  // real check happens when Google refuses to authenticate a nonexistent
  // account anyway.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "That doesn't look like an email address." };
  }

  const existing = await prisma.invite.findUnique({ where: { email } });
  if (existing) return { error: "That address is already invited." };

  await prisma.invite.create({ data: { email, note } });
  revalidatePath("/invites");
  return { success: true };
}

// Removing an invite shuts the door on the next request rather than
// whenever a token would have expired, because sessions are database-backed
// - but only for someone who has not signed in yet. Someone already inside
// keeps their session until it expires or they sign out, which is why the
// page says so rather than implying otherwise.
export async function revokeInvite(id) {
  await prisma.invite.delete({ where: { id } });
  revalidatePath("/invites");
}

// "Name your Domaine" - the estate's own name, as distinct from the
// person's own `name` (see the schema comment on User.domaineName). Never
// takes an id: this always writes the signed-in account's own row via
// currentOwnerId(), the same account this whole page is otherwise silent
// about which one "you" are - so there is nothing here for one account to
// aim at another's row with, unlike revokeInvite/inviteSomeone above,
// which already act on the whole list because the door itself is a
// shared, global thing. Blank clears it back to unset rather than
// leaving an empty string on file, which would render identically but
// read as "set to nothing" instead of "never set."
export async function setDomaineName(formData) {
  const raw = String(formData.get("domaineName") || "").trim();
  const ownerId = await currentOwnerId();
  await prisma.user.update({
    where: { id: ownerId },
    data: { domaineName: raw || null },
  });
  revalidatePath("/invites");
  revalidatePath("/guest");
}
