"use client";

import FilterBar from "@/app/components/FilterBar";
import BottleList from "@/app/components/BottleList";
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
}) {
  const { filters, visible, update, clear } = useBottleFilters(bottles, initialFilters);

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        filters={filters}
        onChange={update}
        onClear={clear}
        regionOptions={regionOptions}
        showDrinkSoon={showDrinkSoon}
        resultCount={visible.length}
        totalCount={bottles.length}
      />
      <BottleList bottles={visible} emptyMessage={emptyMessage} />
    </div>
  );
}
