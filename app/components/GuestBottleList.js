"use client";

import { toggleFavorite } from "@/app/actions";
import FilterBar from "@/app/components/FilterBar";
import useBottleFilters from "@/app/components/useBottleFilters";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
}

// The guest view gets the same instant filtering as the owner's cellar -
// a cellar worth browsing is a cellar too big to scroll - minus the rating
// filter, since a guest is never shown the owner's own scores.
export default function GuestBottleList({ bottles, regionOptions, initialFilters }) {
  const { filters, visible, update, clear } = useBottleFilters(bottles, initialFilters);

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        filters={filters}
        onChange={update}
        onClear={clear}
        regionOptions={regionOptions}
        showRating={false}
        showDrinkSoon={false}
        resultCount={visible.length}
        totalCount={bottles.length}
      />

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {bottles.length === 0
            ? "Nothing in the cellar yet."
            : "No bottles match — try clearing the filters."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((bottle) => (
            <li
              key={bottle.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
            >
              <div>
                <p className="font-medium">
                  {WINE_COLOR_SWATCH[bottle.wineColor] && (
                    <span
                      className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ${WINE_COLOR_SWATCH[bottle.wineColor]}`}
                      title={bottle.wineColor}
                    />
                  )}
                  {bottleHeader(bottle)}
                  {bottle.type ? ` — ${bottle.type}` : ""}
                </p>
                <p className="text-sm text-zinc-500">
                  {[bottle.variety, bottle.region, bottle.country].filter(Boolean).join(" · ")}
                </p>
              </div>
              <form action={toggleFavorite.bind(null, bottle.id)}>
                <button
                  type="submit"
                  className="shrink-0 text-xl leading-none"
                  aria-label={bottle.favorited ? "Remove favorite" : "Favorite this bottle"}
                >
                  {bottle.favorited ? "❤️" : "🤍"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
