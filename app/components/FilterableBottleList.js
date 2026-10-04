"use client";

import FilterBar from "@/app/components/FilterBar";
import CellarOverview from "@/app/components/CellarOverview";
import BottleList from "@/app/components/BottleList";
import { wineSiblingKey } from "@/lib/lot-fields";
import useBottleFilters from "@/app/components/useBottleFilters";

// The server hands over the whole list for a status once; narrowing it is
// pure in-memory work from here on, so typing in the filter bar updates the
// list immediately instead of waiting on a refetch.
export default function FilterableBottleList({
  bottles,
  regionOptions,
  initialFilters,
  emptyMessage,
  // History turns this off: a drinking window is advice about when to open
  // something, which is moot once it's been drunk.
  showDrinkSoon = true,
  showEmptied = false,
  showAcquired = false,
  // Only the cellar supplies this; see BottleList for why.
  flights = null,
  // Only the cellar shows the at-a-glance summary (and its Place filter).
  overview = false,
}) {
  const { filters, visible, update, clear } = useBottleFilters(bottles, initialFilters);
  // Lots per wine across the whole list, not just the filtered rows (see
  // BottleList's lotCounts).
  const lotCounts = {};
  for (const bottle of bottles) {
    const key = wineSiblingKey(bottle);
    lotCounts[key] = (lotCounts[key] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-4">
      {overview && (
        <CellarOverview
          bottles={bottles}
          filters={filters}
          onFilter={(key, value) => update({ ...filters, [key]: value })}
        />
      )}
      <FilterBar
        filters={filters}
        onChange={update}
        onClear={clear}
        regionOptions={regionOptions}
        showDrinkSoon={showDrinkSoon}
        showWindowFilter={!overview}
        showEmptied={showEmptied}
        showAcquired={showAcquired}
        resultCount={visible.length}
        totalCount={bottles.length}
      />
      <BottleList bottles={visible} emptyMessage={emptyMessage} flights={flights} lotCounts={lotCounts} />
    </div>
  );
}
