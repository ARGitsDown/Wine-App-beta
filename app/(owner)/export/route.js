import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";

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
  }

  const [bottles, guests, flights, pairings, researchProposals] = await Promise.all([
    prisma.bottle.findMany({
      include: { tastingNotes: true, photos: true },
      orderBy: { id: "asc" },
    }),
    prisma.guest.findMany({
      include: { favorites: true },
      orderBy: { id: "asc" },
    }),
    prisma.tastingFlight.findMany({
      // Picks in tasting order, so the file reads the way the flight does.
      include: { picks: { orderBy: { order: "asc" } } },
      orderBy: { id: "asc" },
    }),
    prisma.savedPairing.findMany({
      // Same reason as a flight's picks: in the order the pairing reads.
      include: { picks: { orderBy: { order: "asc" } } },
      orderBy: { id: "asc" },
    }),
    prisma.researchProposal.findMany({ orderBy: { id: "asc" } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
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
