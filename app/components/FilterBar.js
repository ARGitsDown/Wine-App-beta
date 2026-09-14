"use client";

import { allVarietalNames } from "@/lib/varietal-match";
import { KNOWN_REGIONS } from "@/lib/regions";
import { WINE_COLORS } from "@/lib/wine-colors";
import { hasAnyFilter } from "@/lib/filter-bottles";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-xs text-zinc-500";

const VARIETY_NAMES = allVarietalNames();

// Controlled inputs that report every keystroke up to the list component,
// which re-filters in memory - no form submit, no navigation, no refetch.
// `rating` is hidden on the guest view, where nobody's own scores are shown
// to filter by in the first place.
export default function FilterBar({
  filters,
  onChange,
  onClear,
  regionOptions = KNOWN_REGIONS,
  showRating = true,
  resultCount,
  totalCount,
}) {
  function set(key, value) {
    onChange({ ...filters, [key]: value });
  }

  const narrowed = resultCount !== totalCount;

  return (
    <details
      open={hasAnyFilter(filters) || undefined}
      className="rounded-lg border border-zinc-200 dark:border-zinc-800"
    >
      {/* Collapsed by default so the list itself is what's on screen first,
          which matters most on a phone - seven always-expanded controls
          otherwise push every bottle below the fold. */}
      <summary className="cursor-pointer px-4 py-2.5 text-sm">
        <span className="font-medium">Search &amp; filter</span>
        <span className="ml-2 text-zinc-500">
          {narrowed
            ? `${resultCount} of ${totalCount} shown`
            : `${totalCount} bottle${totalCount === 1 ? "" : "s"}`}
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
        <datalist id="filter-variety-options">
          {VARIETY_NAMES.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <datalist id="filter-region-options">
          {regionOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <label className={labelClass}>
          Search
          <input
            type="search"
            value={filters.search}
            onChange={(event) => set("search", event.target.value)}
            placeholder="Producer, bottling, region, vintage…"
            className={inputClass}
            autoComplete="off"
          />
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            Variety
            <input
              list="filter-variety-options"
              value={filters.variety}
              onChange={(event) => set("variety", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Region
            <input
              list="filter-region-options"
              value={filters.region}
              onChange={(event) => set("region", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Sub-region
            <input
              value={filters.subRegion}
              onChange={(event) => set("subRegion", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Country
            <input
              value={filters.country}
              onChange={(event) => set("country", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Color
            <select
              value={filters.wineColor}
              onChange={(event) => set("wineColor", event.target.value)}
              className={inputClass}
            >
              <option value="">Any</option>
              {WINE_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Vintage
            <input
              type="number"
              inputMode="numeric"
              value={filters.vintage}
              onChange={(event) => set("vintage", event.target.value)}
              className={inputClass}
            />
          </label>
          {showRating && (
            <label className={labelClass}>
              Min. rating
              <select
                value={filters.rating}
                onChange={(event) => set("rating", event.target.value)}
                className={inputClass}
              >
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </label>
          )}
          {hasAnyFilter(filters) && (
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-zinc-500 underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
