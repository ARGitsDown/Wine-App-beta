import "server-only";
import { db } from "@/lib/scoped-prisma";

// Deletes the given wines, but only those still exactly as they were created:
// still in `status`, with no research proposal, note, photo, favorite, flight
// or pairing attached, and not edited since (updatedAt within five seconds of
// createdAt). Anything the person has since added to or changed is left alone
// and counted in `kept`, so an undo of "I just added these" can never delete
// work. Used by Undo import and Undo add-another-purchase.
export async function deleteUntouchedBottles(ids, status) {
  const wanted = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 2000);
  if (wanted.length === 0) return { removed: 0, kept: 0 };
  const candidates = await db.bottle.findMany({
    where: {
      id: { in: wanted },
      status,
      researchProposal: null,
      tastingNotes: { none: {} },
      photos: { none: {} },
      favorites: { none: {} },
      flightPicks: { none: {} },
      pairingPicks: { none: {} },
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });
  const untouched = candidates
    .filter((row) => row.updatedAt.getTime() - row.createdAt.getTime() < 5000)
    .map((row) => row.id);
  const removed = untouched.length
    ? await db.bottle.deleteMany({ where: { id: { in: untouched }, status } })
    : { count: 0 };
  const kept = await db.bottle.count({ where: { id: { in: wanted } } });
  return { removed: removed.count, kept };
}
