"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  filterBottles,
  sortBottles,
} from "@/lib/filter-bottles";

function filtersFromSearchParams(initial) {
  return { ...EMPTY_FILTERS, ...initial };
}

// Keeps the filter in the address bar so a narrowed list is still
// bookmarkable and shareable, but writes it with history.replaceState
// rather than router.replace: these pages are force-dynamic, so a real
// navigation would refetch the whole list from the server on every
// keystroke - exactly the round-trip this filtering exists to avoid.
function syncUrl(filters) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    // The default order is what you get with no query at all, so spelling
    // it out would put ?sort=producer on every URL for no reason.
    if (value && !(key === "sort" && value === DEFAULT_SORT)) params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
}

export default function useBottleFilters(bottles, initialFilters = {}) {
  const [filters, setFilters] = useState(() => filtersFromSearchParams(initialFilters));

  const update = useCallback((next) => {
    setFilters(next);
    syncUrl(next);
  }, []);

  // Clearing empties the filters but keeps the chosen order: "show me
  // everything again" isn't a request to go back to alphabetical.
  //
  // Built outside the state updater on purpose - syncUrl touches history,
  // which the router reacts to, and React may run an updater during render.
  const clear = useCallback(() => {
    const next = { ...EMPTY_FILTERS, sort: filters.sort };
    setFilters(next);
    syncUrl(next);
  }, [filters.sort]);

  const visible = useMemo(
    () => sortBottles(filterBottles(bottles, filters), filters.sort),
    [bottles, filters]
  );

  return { filters, visible, update, clear };
}
