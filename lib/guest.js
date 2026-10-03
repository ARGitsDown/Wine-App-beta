import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";
import { ROLE } from "@/lib/roles";
import { cellarDisplayName, founderDisplayName } from "@/lib/cellar-name";

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
//
// Wrapped in React's cache() - per request, never across requests - since
// the (guest) layout and the page both need it, and the second call would
// otherwise repeat the session read and the upsert.
export const resolveGuestView = cache(async () => {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  const member = session?.user;
  if (!member?.id || !member.domaineId || member.role !== ROLE.GUEST) return null;

  const guest = await prisma.guest.upsert({
    where: { userId: member.id },
    create: { userId: member.id, name: await guestDisplayName(member) },
    update: {},
  });
  return { domaineId: member.domaineId, guest, member };
});

// The name the Domaine's Cellarmasters see next to this guest's
// favorites. Someone who signed in by email link has no name on file, and
// showing their address there read like a system record rather than a
// friend (BACKLOG #53) - the invite's own "Who is this?" note, in the
// inviter's words, is the better label when there is one.
async function guestDisplayName(member) {
  if (member.name) return member.name;
  const invite = member.email
    ? await prisma.invite.findUnique({ where: { email: member.email }, select: { note: true } })
    : null;
  return invite?.note || member.email || "Guest";
}

// What the guest screens call the cellar being browsed - its name and
// motto, and the founding Cellarmaster's name for "who runs this" - for a
// Domaine resolveGuestView has already settled on. Cached per request for
// the same reason: the layout's header and the page's greeting both use it.
export const getGuestCellar = cache(async (domaineId) => {
  const domaine = await prisma.domaine.findUnique({
    where: { id: domaineId },
    select: {
      name: true,
      motto: true,
      members: {
        where: { role: ROLE.CELLARMASTER },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { name: true, email: true },
      },
    },
  });
  const founder = domaine?.members[0];
  return {
    cellarName: cellarDisplayName(domaine, founder),
    founderName: founderDisplayName(founder),
    motto: domaine?.motto || null,
  };
});
