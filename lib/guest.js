import "server-only";
import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";

// Everything /guest needs to know about who is browsing it, and whose
// cellar: { domaineId, guest, member } - or null for anyone /guest isn't
// for. Shared between the guest page (to render) and toggleFavorite (to
// check the bottle is in the cellar being browsed), so the two can never
// disagree about which cellar that is.
//
// Only a signed-in Guest member (User.role "guest") gets a view: their
// own Domaine's cellar, favoriting as their own Guest row - found by
// userId, created on their first visit, named after their account.
//
// There used to be a second kind of visitor, and this is where it ended:
// an anonymous one, with no account at all, who typed a name that a
// cookie remembered and browsed the original cellar. Retired 2026-09-28
// (BACKLOG #51) - an invited Guest is tied to a real person the Domaine
// chose, can be removed, and is the only kind Phase 4's per-section
// access applies to; a URL anyone could open was none of those. Cookie
// guests' existing Guest rows and favorites were left in place, so the
// names already next to a favorite still show; nothing can add to them.
export async function resolveGuestView() {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  const member = session?.user;
  if (!member?.id || !member.domaineId || member.role !== "guest") return null;

  const guest = await prisma.guest.upsert({
    where: { userId: member.id },
    create: { userId: member.id, name: member.name || member.email || "Guest" },
    update: {},
  });
  return { domaineId: member.domaineId, guest, member };
}
