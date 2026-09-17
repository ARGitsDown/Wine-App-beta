"use client";

import { useState } from "react";
import { allVarietalNames } from "@/lib/varietal-match";
import { KNOWN_REGIONS } from "@/lib/regions";
import { WINE_COLORS } from "@/lib/wine-colors";
import {
  activeFilterChips,
  hasAnyFilter,
  hasAnyPanelFilter,
  sortOptionsFor,
} from "@/lib/filter-bottles";

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
  showDrinkSoon = true,
  showEmptied = false,
  showAcquired = false,
  resultCount,
  totalCount,
}) {
  const sortOptions = sortOptionsFor({
    rating: showRating,
    drinkWindow: showDrinkSoon,
    emptied: showEmptied,
    acquired: showAcquired,
  });
  // Seeded once from whether the page loaded with one of the panel's own
  // fields already set (a shared or bookmarked URL), then left to the
  // user. Deriving it from the current filters instead would snap the
  // panel shut the moment you cleared the last box - while you were still
  // typing in it. Search doesn't factor in here (BACKLOG #27): it's always
  // visible now, so it has nothing inside the panel to reveal.
  const [open, setOpen] = useState(() => hasAnyPanelFilter(filters));

  function set(key, value) {
    onChange({ ...filters, [key]: value });
  }

  const narrowed = resultCount !== totalCount;
  const chips = activeFilterChips(filters);

  return (
    <div className="flex flex-col gap-2">
      {/* Always visible, not behind the disclosure below (BACKLOG #27) -
          the one field with no datalist to lean on for a correct spelling,
          so it's the one that most needs to be in view rather than a tap
          away. */}
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

      <div className="flex flex-wrap items-start gap-2">
        {/* Sort sits outside the collapsible panel, below: reordering a list
            is a frequent, one-click thing, and burying it behind a disclosure
            would make it cost two. */}
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="min-w-64 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800"
      >
        {/* Collapsed by default so the list itself is what's on screen first,
            which matters most on a phone - six always-expanded controls
            otherwise push every bottle below the fold. */}
        <summary className="cursor-pointer px-4 py-2.5 text-sm">
          <span className="font-medium">More filters</span>
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
            {/* Labelled "all", not "Clear", now that Search lives outside
                this panel: this still resets it along with everything
                shown here, the same single onClear the chip row's own
                "Clear all" already uses, so it should say so rather than
                read as scoped to just what's visible in this box. */}
            {hasAnyFilter(filters) && (
              <button
                type="button"
                onClick={onClear}
                className="text-sm text-zinc-500 underline underline-offset-2"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </details>

        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm dark:border-zinc-800">
          <span className="text-zinc-500">Sort</span>
          <select
            value={filters.sort}
            onChange={(event) => set("sort", event.target.value)}
            className="bg-transparent text-sm"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Deliberately its own row rather than inside <summary>: a summary is
          already a button, and burying more buttons in it makes a mess of
          both the markup and the keyboard order. Shown whether the panel is
          open or shut, since the case this exists for is a narrowed list
          under a closed panel. */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="sr-only">Filters applied:</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => set(chip.key, "")}
              aria-label={`Remove filter ${chip.label}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-zinc-300 px-3 text-xs text-zinc-700 hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:focus-visible:outline-zinc-100"
            >
              {chip.label}
              <span aria-hidden="true" className="text-zinc-500">
                &#10005;
              </span>
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={onClear}
              className="min-h-9 rounded px-2 text-xs text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
