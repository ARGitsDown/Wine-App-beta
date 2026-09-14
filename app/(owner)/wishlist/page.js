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
  );
}
