import BackButton from "@/app/components/BackButton";
import ImportPanel from "@/app/components/ImportPanel";

export const dynamic = "force-dynamic";

// For someone arriving with a list: a CellarTracker or Vivino export, or a
// spreadsheet saved as CSV. Scanning is better for a few bottles; this is for
// a few hundred.
export default function ImportPage() {
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
      <p className="text-xs text-zinc-500">
        Understood columns: Producer or Winery, Wine name, Vintage, Quantity, Size, Price, Currency,
        Location, Region, Sub-region or Appellation, Country, Varietal, Color, Begin and End Consume,
        Store, Notes, Purchase date. Prices are kept in USD, EUR, GBP, CAD, AUD or CHF; a price in
        any other currency is left blank. Up to 1,000 rows and 800 KB at a time.
      </p>
    </div>
  );
}
