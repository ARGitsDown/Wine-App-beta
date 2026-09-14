import Link from "next/link";
import { getBottles, getRegionOptions } from "@/lib/bottles";
import { prisma } from "@/lib/prisma";
import { createBottle } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import FilterableBottleList from "@/app/components/FilterableBottleList";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }) {
  const filters = await searchParams;
  const [bottles, regionOptions, missingWindowCount] = await Promise.all([
    getBottles("inventory"),
    getRegionOptions(),
    prisma.bottle.count({
      where: { status: "inventory", drinkFrom: null, drinkTo: null },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-zinc-500">
          Bottles currently in your cellar. Share{" "}
          <span className="font-mono">/guest</span> with friends and family
          so they can favorite what they&apos;d like pulled for their next
          visit — favorites show up here as ❤️.
        </p>
      </div>

      {missingWindowCount > 0 && (
        <Link
          href="/estimate-windows"
          className="rounded-lg border border-amber-300 p-3 text-sm text-amber-800 hover:border-amber-400 dark:border-amber-900 dark:text-amber-400"
        >
          {missingWindowCount} bottle{missingWindowCount === 1 ? "" : "s"}{" "}
          missing a drinking window — estimate now →
        </Link>
      )}

      <FilterableBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
        emptyMessage="No bottles match. Add one below, or clear your filters."
      />

      <details className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer font-medium">
          Add a bottle to inventory
        </summary>
        <div className="mt-4">
          <BottleForm
            action={createBottle.bind(null, "inventory")}
            regionOptions={regionOptions}
          />
        </div>
      </details>
    </div>
  );
}
