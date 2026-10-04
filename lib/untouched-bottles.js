import "server-only";
import { db } from "@/lib/scoped-prisma";

// Deletes the given wines, but only those still exactly as they were created:
// still in `status`, with no research proposal, note, photo, favorite, flight
// or pairing attached, and not edited since (updatedAt within 1.5 seconds of
// createdAt). Anything the person has since added to or changed is left alone
// and counted in `kept`, so an undo of "I just added these" can never delete
// work. `sinceMs`, when given, also requires the wine to have been created
// within that long ago - for an Undo whose ids come from the browser, so it
// can only ever reach what was just made. Used by Undo import (ids held on the
// server in an ImportBatch) and Undo add-another-purchase.
//
// The test leans on `updatedAt` moving whenever the row is written, which
// Prisma does for update, updateMany and upsert: a raw SQL write to Bottle
// would not move it, so any future one must set "updatedAt" itself.
const UNTOUCHED = {
  researchProposal: null,
  tastingNotes: { none: {} },
  photos: { none: {} },
  favorites: { none: {} },
  flightPicks: { none: {} },
  pairingPicks: { none: {} },
};

export async function deleteUntouchedBottles(ids, status, { sinceMs = null } = {}) {
  const wanted = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 2000);
  if (wanted.length === 0) return { removed: 0, kept: 0 };
  const candidates = await db.bottle.findMany({
    where: {
      id: { in: wanted },
      status,
      ...(sinceMs ? { createdAt: { gte: new Date(Date.now() - sinceMs) } } : {}),
      ...UNTOUCHED,
    },
    select: { id: true, createdAt: true, updatedAt: true },
  });
  const untouched = candidates
    .filter((row) => row.updatedAt.getTime() - row.createdAt.getTime() < 1500)
    .map((row) => row.id);
  // The child conditions are repeated: a note added in another tab between the
  // read above and this delete would otherwise be cascade-deleted with it.
  const removed = untouched.length
    ? await db.bottle.deleteMany({ where: { id: { in: untouched }, status, ...UNTOUCHED } })
    : { count: 0 };
  const kept = await db.bottle.count({ where: { id: { in: wanted } } });
  return { removed: removed.count, kept };
}
