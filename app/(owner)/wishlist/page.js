import Link from "next/link";
import { getBottles, getRegionOptions } from "@/lib/bottles";
import { createBottle } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import FilterableBottleList from "@/app/components/FilterableBottleList";
import { ScanIcon } from "@/app/components/icons";

export const dynamic = "force-dynamic";

export default async function WishlistPage({ searchParams }) {
  const filters = await searchParams;
  const [bottles, regionOptions] = await Promise.all([
    getBottles("wishlist"),
    getRegionOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Wishlist</h1>
        <p className="text-sm text-zinc-500">Bottles to try or buy.</p>
      </div>

      {/* Adding comes before browsing: the two ways in sit at the top, then
          the controls for narrowing what is already here, then the list
          itself. The intent travels in the link, so the scanner opens
          pointed at the wishlist rather than defaulting to the cellar - the
          only destination that makes sense from this page, and a wine that
          turns out to belong somewhere else can be moved on its own card. */}
      <div className="flex flex-col gap-3">
        <Link
          href="/scan?intent=wishlist"
          className="flex items-center justify-center gap-2.5 rounded-lg border border-zinc-300 px-4 py-3 font-medium hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        >
          <ScanIcon className="h-5 w-5" />
          Scan a label or shelf
        </Link>

        <details className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer font-medium">
            Add a bottle to your wishlist
          </summary>
          <div className="mt-4">
            <BottleForm
              action={createBottle.bind(null, "wishlist")}
              regionOptions={regionOptions}
            />
          </div>
        </details>
      </div>

      <FilterableBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
        emptyMessage="No bottles match. Add one above, or clear your filters."
      />
    </div>
  );
}
