import { getBottles, getRegionOptions } from "@/lib/bottles";
import FilterableBottleList from "@/app/components/FilterableBottleList";

export const dynamic = "force-dynamic";

export default async function ConsumedPage({ searchParams }) {
  const filters = await searchParams;
  const [bottles, regionOptions] = await Promise.all([
    getBottles("consumed"),
    getRegionOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Tasting history</h1>
        <p className="text-sm text-zinc-500">
          Bottles you&apos;ve finished, with their tasting notes.
        </p>
      </div>

      <FilterableBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
        showDrinkSoon={false}
        showEmptied
        emptyMessage="Nothing here yet — bottles you mark as finished from Inventory will show up here."
      />
    </div>
  );
}
