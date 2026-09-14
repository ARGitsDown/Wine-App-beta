import { getBottles, getRegionOptions } from "@/lib/bottles";
import FilterBar from "@/app/components/FilterBar";
import BottleList from "@/app/components/BottleList";

export const dynamic = "force-dynamic";

export default async function ConsumedPage({ searchParams }) {
  const filters = await searchParams;
  const [bottles, regionOptions] = await Promise.all([
    getBottles("consumed", filters),
    getRegionOptions(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-sm text-zinc-500">
          Bottles you&apos;ve finished, with their tasting notes.
        </p>
      </div>

      <FilterBar basePath="/consumed" filters={filters} regionOptions={regionOptions} />

      <BottleList
        bottles={bottles}
        emptyMessage="Nothing here yet — bottles you mark as finished from Inventory will show up here."
      />
    </div>
  );
}
