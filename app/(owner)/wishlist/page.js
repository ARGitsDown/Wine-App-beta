import { getBottles, getRegionOptions } from "@/lib/bottles";
import { currentOwnerId } from "@/lib/owner";
import { createBottle } from "@/app/actions";
import BottleForm from "@/app/components/BottleForm";
import FilterableBottleList from "@/app/components/FilterableBottleList";
import ScanAndAddRow from "@/app/components/ScanAndAddRow";

export const dynamic = "force-dynamic";

export default async function WishlistPage({ searchParams }) {
  const filters = await searchParams;
  const ownerId = await currentOwnerId();
  const [bottles, regionOptions] = await Promise.all([
    getBottles("wishlist"),
    getRegionOptions(ownerId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Wishlist</h1>
        <p className="text-sm text-zinc-500">Bottles to try or buy.</p>
      </div>

      {/* Scan and hand entry on one line (BACKLOG #26), matching Cellar's
          treatment now instead of the wishlist's own bordered-box version:
          the intent still travels in the scan link, so the scanner opens
          pointed at the wishlist rather than defaulting to the cellar - the
          only destination that makes sense from this page, and a wine that
          turns out to belong somewhere else can be moved on its own card. */}
      <ScanAndAddRow scanHref="/scan?intent=wishlist">
        <BottleForm
          action={createBottle.bind(null, "wishlist")}
          regionOptions={regionOptions}
        />
      </ScanAndAddRow>

      <FilterableBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
        emptyMessage="No bottles match. Add one above, or clear your filters."
      />
    </div>
  );
}
