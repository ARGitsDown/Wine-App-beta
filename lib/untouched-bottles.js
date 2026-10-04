import "server-only";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/scoped-prisma";
import { currentDomaineId } from "@/lib/owner";
import { snapshotOf, trashCutoff, wineLabel } from "@/lib/bottle-trash";

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
// What is removed goes to the recycle bin (BottleTrash) first, like any other
// deleted wine, so "Recently deleted" can bring it back. They are untouched, so
// their snapshots carry no notes, photos or links.
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
  const removed = untouched.length ? await binAndDelete(untouched, status) : 0;
  const kept = await db.bottle.count({ where: { id: { in: wanted } } });
  return { removed, kept };
}

// Snapshots, then deletes, in one transaction on the plain client (every
// statement names the Domaine by hand). If a row gained something between the
// scoped read and here and so was not deleted, its bin entry is taken back out.
async function binAndDelete(ids, status) {
  const domaineId = await currentDomaineId();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.bottle.findMany({ where: { id: { in: ids }, domaineId, status, ...UNTOUCHED } });
    if (rows.length === 0) return 0;
    await tx.bottleTrash.createMany({
      data: rows.map((row) => ({
        domaineId,
        bottleId: row.id,
        label: wineLabel(row),
        listedIn: row.status,
        snapshot: snapshotOf(row),
      })),
    });
    const deleted = await tx.bottle.deleteMany({
      where: { id: { in: rows.map((row) => row.id) }, domaineId, status, ...UNTOUCHED },
    });
    if (deleted.count !== rows.length) {
      const remaining = await tx.bottle.findMany({
        where: { id: { in: rows.map((row) => row.id) } },
        select: { id: true },
      });
      await tx.bottleTrash.deleteMany({
        where: { domaineId, bottleId: { in: remaining.map((row) => row.id) } },
      });
    }
    await tx.bottleTrash.deleteMany({ where: { domaineId, deletedAt: { lt: trashCutoff() } } });
    return deleted.count;
  });
}
