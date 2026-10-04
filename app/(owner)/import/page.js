import { BOTTLE_STATUS } from "@/lib/bottle-status";
import BackButton from "@/app/components/BackButton";
import ImportPanel from "@/app/components/ImportPanel";
import RecentImports from "@/app/components/RecentImports";
import { db } from "@/lib/scoped-prisma";
import { trashCutoff } from "@/lib/bottle-trash";

export const dynamic = "force-dynamic";

// For someone arriving with a list: a CellarTracker or Vivino export, or a
// spreadsheet saved as CSV. Scanning is better for a few bottles; this is for
// a few hundred.
export default async function ImportPage() {
  // The recent few. Old batches are purged by the next import of this Domaine,
  // so the reader applies the 30-day cutoff itself.
  const batches = await db.importBatch.findMany({
    where: { createdAt: { gte: trashCutoff() } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  // Only batches that still have wines in them: one whose wines are all gone
  // (undone, or deleted one by one) has nothing left to undo.
  const remaining = await Promise.all(
    batches.map((batch) =>
      db.bottle.count({ where: { id: { in: batch.bottleIds }, status: batch.status } })
    )
  );
  const recent = batches
    .map((batch, i) => ({
      id: batch.id,
      remaining: remaining[i],
      destination: batch.status === BOTTLE_STATUS.INVENTORY ? "Cellar" : "Wishlist",
      when: batch.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }))
    .filter((batch) => batch.remaining > 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <BackButton fallbackHref="/inventory" />
      <div>
        <h1 className="text-2xl font-semibold">Import a list</h1>
        <p className="text-sm text-zinc-500">
          A CSV from CellarTracker or Vivino, or a spreadsheet saved as CSV. The first row should be the
          column names. You see what will be added before anything is, and can undo it afterwards.
        </p>
      </div>
      <ImportPanel />
      <RecentImports batches={recent} />
      <p className="text-xs text-zinc-500">
        Understood columns: Producer or Winery, Wine name, Vintage, Quantity, Size, Price, Currency,
        Location, Region, Sub-region or Appellation, Country, Varietal, Color, Begin and End Consume,
        Store, Notes, Purchase date. Prices are kept in USD, EUR, GBP, CAD, AUD or CHF; a price in
        any other currency is left blank. Up to 1,000 rows and 800 KB at a time.
      </p>
    </div>
  );
}
