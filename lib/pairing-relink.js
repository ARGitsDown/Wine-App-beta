import "server-only";
import { prisma } from "@/lib/prisma";
import { db } from "@/lib/scoped-prisma";
import { siblingLotFor } from "@/lib/pairings";

// A pairing is kept pointing at a bottle row, and a wine held as two purchases
// is two rows: finish the one a pick points at and the pick used to read "No
// longer in your cellar" with the other purchase still on the shelf. This
// moves such a pick over to the other purchase (the lowest id of the same wine,
// lib/wine-key.js), saved so the Drink, Hold and "We drank it" buttons, which
// act on the pick's bottle, work on it. Done when a pairing is read, because
// the finishing happens somewhere else entirely (the Cellar, a flight) and
// nothing there knows which pairings point at the row. Idempotent, and only
// ever touches picks of this owner's pairings, which the caller already read
// through the scoped client. Returns the picks with `bottle` swapped.
//
// `picks` must carry bottle: { id, status, producer, bottling, vintage, quantity }.
export async function followOtherLots(picks) {
  const finished = picks.filter((pick) => !pick.gap && !pick.drankAt && pick.bottle && pick.bottle.status !== "inventory");
  if (finished.length === 0) return picks;

  const producers = [...new Set(finished.map((pick) => pick.bottle.producer))];
  const lots = await db.bottle.findMany({
    where: {
      status: "inventory",
      OR: producers.map((producer) => ({ producer: { equals: producer, mode: "insensitive" } })),
    },
    select: { id: true, status: true, producer: true, bottling: true, vintage: true, quantity: true },
  });

  const moved = new Map();
  for (const pick of finished) {
    const lot = siblingLotFor(pick, lots);
    if (lot) moved.set(pick.id, lot);
  }
  if (moved.size === 0) return picks;

  try {
    await prisma.$transaction(
      [...moved].map(([pickId, lot]) =>
        prisma.pairingPick.updateMany({
          // Only while still pointing at a finished wine: a pick the owner has
          // since moved on is left alone.
          where: { id: pickId, drankAt: null, bottle: { status: { not: "inventory" } } },
          data: { bottleId: lot.id },
        })
      )
    );
  } catch (err) {
    // The page still reads true without it (shown as followed), and the next
    // read tries again.
    console.error("Couldn't move pairing picks to another lot of the same wine:", err);
  }
  return picks.map((pick) => (moved.has(pick.id) ? { ...pick, bottle: moved.get(pick.id) } : pick));
}
