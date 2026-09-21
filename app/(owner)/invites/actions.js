"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/invite-policy";

// The invite list is the whole of "invite-only", so these two actions are
// the only way into this app and the only way to close it again. Kept
// beside the page they serve rather than in app/actions.js, which is
// entirely about wine.

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
