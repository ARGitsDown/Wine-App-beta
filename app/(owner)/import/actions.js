"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/scoped-prisma";
import { currentOwnerId } from "@/lib/owner";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { acquiredAtForStatus } from "@/lib/bottle-dates";
import { MAX_IMPORT_BYTES, duplicateKey, prepareImport } from "@/lib/import-wines";

// Import from a CSV (CellarTracker, Vivino, or a spreadsheet): a preview that
// writes nothing, then the import, then an undo. The file is read again on
// import rather than trusting what the browser says the preview contained, so
// what is written is what the server itself parsed.

const DESTINATIONS = { inventory: "Cellar", wishlist: "Wishlist" };

async function readUpload(formData) {
  const file = formData.get("file");
  if (!file || typeof file === "string" || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > MAX_IMPORT_BYTES) {
    return { error: "That file is too big (limit 800 KB). Split it and import in parts." };
  }
  const status = String(formData.get("destination") || "inventory");
  if (!Object.hasOwn(DESTINATIONS, status)) return { error: "Choose where the wines should go." };
  const prepared = prepareImport(await file.text());
  if (!prepared.ok) return { error: prepared.error };
  return { prepared, status, fileKey: `${file.name}:${file.size}` };
}

// Same wine already on that list (producer, bottling, vintage): skipped, so
// running an import twice - or importing a file that overlaps what is there -
// does not double the cellar.
async function splitDuplicates(wines, status) {
  const existing = await db.bottle.findMany({
    where: { status },
    select: { producer: true, bottling: true, vintage: true },
  });
  const known = new Set(existing.map(duplicateKey));
  const fresh = [];
  const duplicates = [];
  for (const wine of wines) (known.has(duplicateKey(wine)) ? duplicates : fresh).push(wine);
  return { fresh, duplicates };
}

const SHOWN = 8;

export async function previewImport(prevState, formData) {
  const read = await readUpload(formData);
  if (read.error) return { error: read.error };
  const { prepared, status, fileKey } = read;
  const { fresh, duplicates } = await splitDuplicates(prepared.wines, status);
  return {
    preview: {
      fileKey,
      status,
      destination: DESTINATIONS[status],
      mapping: prepared.mapping,
      ignored: prepared.ignored,
      importable: fresh.length,
      duplicates: duplicates.length,
      skipped: prepared.skipped.length,
      skippedShown: prepared.skipped.slice(0, SHOWN),
      warnings: prepared.warnings.length,
      warningsShown: prepared.warnings.slice(0, SHOWN),
      sample: fresh.slice(0, SHOWN).map((wine) => ({
        producer: wine.producer,
        bottling: wine.bottling,
        vintage: wine.vintage,
        quantity: wine.quantity,
        place: wine.location,
      })),
    },
  };
}

export async function commitImport(prevState, formData) {
  const read = await readUpload(formData);
  if (read.error) return { error: read.error };
  const { prepared, status } = read;
  const { fresh } = await splitDuplicates(prepared.wines, status);
  if (fresh.length === 0) return { error: "Nothing new to import." };

  const ownerId = await currentOwnerId();
  const rows = fresh.map((wine) => ({
    ownerId,
    producer: wine.producer,
    bottling: wine.bottling,
    vintage: wine.vintage,
    variety: wine.variety,
    canonicalVariety: canonicalizeVarietal(null, wine.variety),
    region: wine.region,
    subRegion: wine.subRegion,
    country: wine.country,
    wineColor: wine.wineColor,
    drinkFrom: wine.drinkFrom,
    drinkTo: wine.drinkTo,
    notes: wine.notes,
    status,
    // A wishlist wine is not owned: no count beyond one, no place, no price,
    // no arrival date (the same rule acquiredAtForStatus applies).
    quantity: status === "inventory" ? wine.quantity : 1,
    sizeMl: wine.sizeMl,
    location: status === "inventory" ? wine.location : null,
    pricePaidCents: status === "inventory" ? wine.pricePaidCents : null,
    priceCurrency: status === "inventory" ? wine.priceCurrency : null,
    acquiredAt: acquiredAtForStatus(status, status === "inventory" ? wine.acquiredAt : null),
  }));

  try {
    const created = await db.bottle.createManyAndReturn({ data: rows, select: { id: true } });
    revalidatePath(status === "inventory" ? "/inventory" : "/wishlist");
    return { done: { count: created.length, status, destination: DESTINATIONS[status], ids: created.map((row) => row.id) } };
  } catch (err) {
    console.error("Import failed:", err);
    return { error: "Couldn't import that file. Nothing was added." };
  }
}

// Takes back what an import added, but only wines still exactly where the
// import put them and with nothing of the person's own attached since - a
// tasting note, a photo, a favorite, a flight or pairing that uses it. Those
// are kept and counted, so an undo can never delete work.
export async function undoImport(ids, status) {
  const wanted = (Array.isArray(ids) ? ids : []).map(Number).filter(Number.isInteger).slice(0, 2000);
  if (wanted.length === 0 || !Object.hasOwn(DESTINATIONS, status)) return { error: "Nothing to undo." };
  const removed = await db.bottle.deleteMany({
    where: {
      id: { in: wanted },
      status,
      tastingNotes: { none: {} },
      photos: { none: {} },
      favorites: { none: {} },
      flightPicks: { none: {} },
      pairingPicks: { none: {} },
    },
  });
  const kept = await db.bottle.count({ where: { id: { in: wanted } } });
  revalidatePath("/inventory");
  revalidatePath("/wishlist");
  return { ok: true, removed: removed.count, kept };
}
