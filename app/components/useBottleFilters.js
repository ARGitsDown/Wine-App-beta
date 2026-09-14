"use client";

import { useCallback, useMemo, useState } from "react";
import { EMPTY_FILTERS, filterBottles } from "@/lib/filter-bottles";

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
    if (value) params.set(key, value);
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

  const clear = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    syncUrl(EMPTY_FILTERS);
  }, []);

  const visible = useMemo(() => filterBottles(bottles, filters), [bottles, filters]);

  return { filters, visible, update, clear };
}
