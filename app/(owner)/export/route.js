import { prisma } from "@/lib/prisma";
import { db } from "@/lib/scoped-prisma";
import { currentDomaineId } from "@/lib/owner";
import { auth, isAuthConfigured } from "@/lib/auth";
import { ROLE } from "@/lib/roles";

export const dynamic = "force-dynamic";

// A full JSON backup of everything in the database - cheap peace of mind
// for a personal system with no other backup story. Not paginated or
// filtered: a personal cellar is small enough that the whole thing fits in
// one response.
//
// "Everything" means everything a human would be sad to lose, which is not
// the same as every table. Flights are the clearest case: they're
// hand-curated, they exist nowhere else, and they were missing from this
// file until BACKLOG.md #18. Kept pairings are here on the same footing -
// a pairing exists only because someone decided it was worth keeping,
// which is the test at the bottom of this comment. Research proposals are
// here because a queue of reviewed-but-not-yet-accepted answers is work
// you'd have to pay to redo. Photo rows are here for their URLs - the
// images themselves live in blob storage and are not in this file.
//
// DrinkWindowEstimate is deliberately left out. It's a cache keyed on the
// wine rather than user data (see lib/drink-window-cache.js): losing it
// costs money to refill, not information, and including it would bulk up
// the file with rows nobody would ever read.
//
// A new model that holds something the owner typed, curated or reviewed
// belongs here. One that only memoises an answer does not.
export async function GET() {
  // Route handlers do not render layouts, so the front door in
  // app/(owner)/layout.js does NOT cover this file despite it sitting in
  // that folder. Found the hard way: with accounts switched on, every page
  // correctly redirected to /signin while this route happily returned the
  // entire cellar - every bottle, note and photo URL - to anyone who asked.
  //
  // The lesson generalises. A guard placed in a layout protects pages and
  // nothing else; each route handler needs its own. There are three in this
  // app: this one, the Auth.js endpoints (public by necessity), and the
  // research step route (guarded by its job token).
  if (isAuthConfigured()) {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Not signed in." }, { status: 401 });
    }
    // Same reasoning, one step further: the layout's guest-role redirect
    // doesn't cover this file either, and a guest-role member is not
    // someone the whole cellar should be downloadable by.
    if (session.user.role !== ROLE.CELLARMASTER) {
      return Response.json({ error: "Only a Cellarmaster can export." }, { status: 403 });
    }
  }

  const domaineId = await currentDomaineId();

  const [bottles, guests, flights, pairings, researchProposals, domaine, invites, members] = await Promise.all([
    db.bottle.findMany({
      include: { tastingNotes: true, photos: true },
      orderBy: { id: "asc" },
    }),
    // Guest isn't owner-scoped by lib/scoped-prisma.js's extension (see
    // that file) - it's shared browsing-identity state, not cellar data.
    // But favorites point at bottles, and a favorite on someone else's
    // bottle isn't this Domaine's to export. Filtered here explicitly:
    // favorites narrowed to this Domaine's bottles, and only guests who
    // have at least one such favorite - a guest who has only ever
    // favorited another Domaine's cellar has nothing to say about this
    // one.
    prisma.guest.findMany({
      where: { favorites: { some: { bottle: { domaineId } } } },
      include: { favorites: { where: { bottle: { domaineId } } } },
      orderBy: { id: "asc" },
    }),
    db.tastingFlight.findMany({
      // Picks in tasting order, so the file reads the way the flight does.
      include: { picks: { orderBy: { order: "asc" } } },
      orderBy: { id: "asc" },
    }),
    db.savedPairing.findMany({
      // Same reason as a flight's picks: in the order the pairing reads.
      include: { picks: { orderBy: { order: "asc" } } },
      orderBy: { id: "asc" },
    }),
    db.researchProposal.findMany({ orderBy: { id: "asc" } }),
    // The Domaine itself and the people around it - things a person typed
    // (an estate's name and motto, a "who is this?" note on an invite) and
    // would be sad to lose, which is this file's own test. On the plain
    // client, scoped by hand: none of these models are cellar data the
    // scoping extension covers. Deliberately not here: the AI usage ledger
    // and the monthly limits - those are the app owner's, not the cellar's
    // (see /usage) - and anything secret: a session, a sign-in token.
    prisma.domaine.findUnique({
      where: { id: domaineId },
      select: { name: true, motto: true, createdAt: true },
    }),
    prisma.invite.findMany({
      where: { domaineId },
      select: { email: true, note: true, access: true, createdAt: true, acceptedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { domaineId },
      select: { name: true, email: true, role: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
  ]);

  const payload = {
    // The shape of this file, so a reader (or a future restore) can tell
    // which one it has:
    //   1 - before the pairing plan: SavedPairing carried plannedForTonight
    //       and plannedForTonightAt (no schemaVersion key at all).
    //   2 - SavedPairing.plannedFor, a calendar day anchored at noon UTC
    //       ("2026-10-04T12:00:00.000Z"), replaces both; PairingPick gains
    //       `decision` (null | "drink" | "hold"). On a gap pick, `bottleId`
    //       may point at a wishlist bottle linked by choosing Drink.
    //   3 - Bottle gains the lot columns `sizeMl`, `location`, `pricePaidCents`
    //       and `priceCurrency` (each null = not recorded); PairingPick gains
    //       `drankAt` and `drankTookBottle`. A bottle row is one lot, so
    //       "what the cellar is worth" is the sum of quantity x pricePaidCents
    //       over cellar rows in one currency.
    //       BottleTrash (the 30-day recycle bin for deleted wines) is
    //       deliberately NOT exported: it is not part of the cellar.
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    domaine,
    members,
    invites,
    bottles,
    guests,
    flights,
    pairings,
    researchProposals,
  };

  const filename = `wine-cellar-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
