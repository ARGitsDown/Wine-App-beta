import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// A full JSON backup of everything in the database - cheap peace of mind
// for a personal system with no other backup story. Not paginated or
// filtered: a personal cellar is small enough that the whole thing fits in
// one response.
export async function GET() {
  // Every table somebody authored by hand. `include` means new *columns*
  // ride along here for free, but a new *model* does not - each one has to
  // be added below, or it is simply missing from the backup with nothing to
  // say so.
  const [bottles, guests, flights, photos] = await Promise.all([
    prisma.bottle.findMany({
      include: { tastingNotes: true },
      orderBy: { id: "asc" },
    }),
    prisma.guest.findMany({
      include: { favorites: true },
      orderBy: { id: "asc" },
    }),
    // A flight carries a name, a theme and a running order somebody built -
    // none of it derivable from the bottles themselves.
    prisma.tastingFlight.findMany({
      include: { picks: true },
      orderBy: { id: "asc" },
    }),
    // Bottle.photoUrl rides along as a column, but photos added after the
    // fact are their own rows: without these the blobs survive in storage
    // and the link from bottle to blob doesn't.
    prisma.bottlePhoto.findMany({ orderBy: { id: "asc" } }),
  ]);

  // Deliberately left out: DrinkWindowEstimate, a cache that rebuilds by
  // asking again, and ResearchProposal, unreviewed state that is transient
  // by design. Nothing a human wrote is in either.
  const payload = {
    exportedAt: new Date().toISOString(),
    bottles,
    guests,
    flights,
    photos,
  };

  const filename = `wine-cellar-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
