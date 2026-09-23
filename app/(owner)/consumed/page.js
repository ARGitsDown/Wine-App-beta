import { getBottles, getRegionOptions } from "@/lib/bottles";
import { currentOwnerId } from "@/lib/owner";
import FilterableBottleList from "@/app/components/FilterableBottleList";

export const dynamic = "force-dynamic";

export default async function ConsumedPage({ searchParams }) {
  const filters = await searchParams;
  const ownerId = await currentOwnerId();
  const [bottles, regionOptions] = await Promise.all([
    // The one page that renders note text - see getBottles for why this is
    // opt-in rather than the default.
    getBottles("consumed", { withLatestNote: true }),
    getRegionOptions(ownerId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Tasting notes</h1>
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
        showAcquired
        emptyMessage="Nothing here yet — bottles you mark as finished from your cellar will show up here."
      />
    </div>
  );
}
