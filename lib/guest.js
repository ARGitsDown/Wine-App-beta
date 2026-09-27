import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";
import { anonymousGuestDomaineId } from "@/lib/owner";

export const GUEST_COOKIE = "guestId";

// Reads the guest identity (if any) for the current browser, from the
// cookie set by entering a name at /guest.
async function cookieGuest() {
  const cookieStore = await cookies();
  const guestId = Number(cookieStore.get(GUEST_COOKIE)?.value);
  if (!Number.isInteger(guestId)) return null;
  // A cookie guest only - a member's Guest row (userId set) is theirs
  // alone and never reachable by typing its id into a cookie.
  return prisma.guest.findFirst({ where: { id: guestId, userId: null } });
}

// Everything /guest needs to know about who is browsing it, and whose
// cellar: { domaineId, guest, member }. Shared between the guest page (to
// render) and toggleFavorite (to check the bottle is in the cellar being
// browsed), so the two can never disagree about which cellar that is.
//
// Three kinds of visitor, since Phase 1 of Shared cellars:
//   - A guest-role member (signed in, User.role "guest"): their own
//     Domaine's cellar, favoriting as their own Guest row - found by
//     userId, created on their first visit, named after their account.
//     No name form and no cookie: the account already says who they are.
//   - A Cellarmaster previewing /guest: their own Domaine's cellar, with
//     the ordinary cookie identity - the same view they'd send a friend.
//   - Anyone else (no session, or accounts switched off): the original
//     cellar (anonymousGuestDomaineId in lib/owner.js) and the cookie
//     identity, exactly as /guest always worked.
//
// `member` is the session's user for the first two, null for the third.
export async function resolveGuestView() {
  let member = null;
  if (isAuthConfigured()) {
    const session = await auth();
    if (session?.user?.id && session.user.domaineId) member = session.user;
  }

  if (member?.role === "guest") {
    const guest = await prisma.guest.upsert({
      where: { userId: member.id },
      create: { userId: member.id, name: member.name || member.email || "Guest" },
      update: {},
    });
    return { domaineId: member.domaineId, guest, member };
  }

  return {
    domaineId: member ? member.domaineId : await anonymousGuestDomaineId(),
    guest: await cookieGuest(),
    member,
  };
}
