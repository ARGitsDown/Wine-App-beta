"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/scoped-prisma";
import { currentOwnerId } from "@/lib/owner";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { acquiredAtForStatus } from "@/lib/bottle-dates";
import { MAX_IMPORT_BYTES, duplicateKey, lotKey, prepareImport } from "@/lib/import-wines";
import { adoptExistingLocation } from "@/lib/lot-fields";
import { deleteUntouchedBottles } from "@/lib/untouched-bottles";

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

// A place spelled differently from one already on file (only in capitals or
// spacing) files under the existing spelling, the same rule the form follows,
// and the places inside the file are made consistent with each other too.
async function adoptLocations(wines) {
  const rows = await db.bottle.findMany({
    where: { location: { not: null } },
    distinct: ["location"],
    select: { location: true },
  });
  const known = rows.map((row) => row.location);
  return wines.map((wine) => {
    if (!wine.location) return wine;
    const location = adoptExistingLocation(wine.location, known);
    if (!known.includes(location)) known.push(location);
    return { ...wine, location };
  });
}

// Already there: on the Cellar, the same lot (wine, size, place, price) - so
// a second purchase at another price is new, but re-running a file adds
// nothing; on the Wishlist, the same wine, since a wishlist row has no lot.
// Skipped, so importing twice - or a file that overlaps what is there - does
// not double the cellar.
async function splitDuplicates(wines, status) {
  const existing = await db.bottle.findMany({
    where: { status },
    select: {
      producer: true,
      bottling: true,
      vintage: true,
      sizeMl: true,
      location: true,
      pricePaidCents: true,
      priceCurrency: true,
    },
  });
  const keyOf = status === "inventory" ? lotKey : duplicateKey;
  const known = new Set(existing.map(keyOf));
  const fresh = [];
  const duplicates = [];
  for (const wine of await adoptLocations(wines)) (known.has(keyOf(wine)) ? duplicates : fresh).push(wine);
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
    // A window from someone else's file is not the owner's own call, so it
    // is marked estimated (and Research may improve it).
    drinkWindowEstimated: wine.drinkFrom != null || wine.drinkTo != null,
    notes: wine.notes,
    status,
    // A wishlist wine is not owned: no count beyond one, no place, no price,
    // no arrival date (the same rule acquiredAtForStatus applies).
    quantity: status === "inventory" ? wine.quantity : 1,
    sizeMl: wine.sizeMl,
    location: status === "inventory" ? wine.location : null,
    pricePaidCents: status === "inventory" ? wine.pricePaidCents : null,
    priceCurrency: status === "inventory" ? wine.priceCurrency : null,
    acquiredAt:
      // false = the file had a date that could not be read: unknown, not today.
      wine.acquiredAt === false ? null : acquiredAtForStatus(status, status === "inventory" ? wine.acquiredAt : null),
  }));

  try {
    const created = await db.bottle.createManyAndReturn({ data: rows, select: { id: true } });
    // Remembered server-side so the Undo outlives this page and never has to
    // trust ids sent back by a browser; old batches are purged here.
    const batch = await db.importBatch.create({
      data: { status, bottleIds: created.map((row) => row.id) },
    });
    await db.importBatch.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 30 * 86400000) } } });
    revalidatePath(status === "inventory" ? "/inventory" : "/wishlist");
    revalidatePath("/import");
    return { done: { count: created.length, status, destination: DESTINATIONS[status], batchId: batch.id } };
  } catch (err) {
    console.error("Import failed:", err);
    return { error: "Couldn't import that file. Nothing was added." };
  }
}

// Takes back what an import added, but only wines still exactly as the import
// left them (see deleteUntouchedBottles). Anything the person has since added
// to or changed is kept and counted, so an undo can never delete work.
export async function undoImport(batchId) {
  const id = Number(batchId);
  if (!Number.isInteger(id)) return { error: "Nothing to undo." };
  const batch = await db.importBatch.findUnique({ where: { id } });
  if (!batch) return { error: "That import can't be undone any more." };
  const { removed, kept } = await deleteUntouchedBottles(batch.bottleIds, batch.status);
  await db.importBatch.deleteMany({ where: { id } });
  revalidatePath("/inventory");
  revalidatePath("/wishlist");
  revalidatePath("/import");
  return { ok: true, removed, kept };
}
