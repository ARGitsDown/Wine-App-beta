import Link from "next/link";
import { getBottles, getRegionOptions } from "@/lib/bottles";
import { createBottle } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import FilterableBottleList from "@/app/components/FilterableBottleList";

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

      <FilterableBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
        emptyMessage="No bottles match. Add one below, or clear your filters."
      />

      {/* The other way to add bottles, next to the by-hand form rather than
          somewhere else entirely. The intent travels in the link, so the
          scanner opens already pointed here instead of defaulting to the
          cellar and needing to be corrected. */}
      <div className="flex flex-col gap-3">
        <Link
          href="/scan?intent=wishlist"
          className="self-start rounded border border-zinc-300 px-3 py-1.5 text-sm hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        >
          Scan a label or shelf →
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
    </div>
  );
}
