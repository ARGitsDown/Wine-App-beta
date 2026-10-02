"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/actions";
import FilterBar from "@/app/components/FilterBar";
import useBottleFilters from "@/app/components/useBottleFilters";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";
import { wineDetail } from "@/lib/wine-origin";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
}

// Was a plain `<form action={toggleFavorite}>` - it worked, but a tap gave
// no sign anything happened until the page quietly re-rendered, and the
// bare emoji was a ~20px target (BACKLOG #29 finding 8). `useTransition`
// (the same pattern QuantityStepper already uses) disables the button and
// dims it while the toggle is in flight, and the button itself is now a
// real 44px target rather than just the glyph's own ink.
//
// Drawn rather than an emoji: the empty state was 🤍, a white heart that
// all but vanished on a white page in light mode - on the guest's one
// action (BACKLOG #53). An outlined mid-grey heart reads in both themes;
// filled red once favorited.
function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FavoriteButton({ bottle }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => toggleFavorite(bottle.id))}
      disabled={pending}
      aria-label={bottle.favorited ? "Remove favorite" : "Favorite this bottle"}
      aria-pressed={bottle.favorited}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40 ${
        bottle.favorited ? "text-red-600 dark:text-red-500" : "text-zinc-400 dark:text-zinc-500"
      }`}
    >
      <HeartIcon filled={bottle.favorited} />
    </button>
  );
}

// The guest view gets the same instant filtering as the owner's cellar -
// a cellar worth browsing is a cellar too big to scroll - minus the rating
// filter, since a guest is never shown the owner's own scores.
//
// "My favorites" narrows to what this guest has already picked, on top of
// whatever else is filtered - a friend browsing a few hundred bottles had
// no way back to their own shortlist except scrolling for red hearts.
export default function GuestBottleList({ bottles, regionOptions, initialFilters }) {
  const { filters, visible: filtered, update, clear } = useBottleFilters(bottles, initialFilters);
  const [onlyMine, setOnlyMine] = useState(false);
  const favoriteCount = bottles.filter((bottle) => bottle.favorited).length;
  // Un-favoriting the last pick hides the toggle, so it must stop
  // filtering too - otherwise the list empties with no control to undo it.
  const showingMine = onlyMine && favoriteCount > 0;
  const visible = showingMine ? filtered.filter((bottle) => bottle.favorited) : filtered;

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

      {favoriteCount > 0 && (
        <button
          type="button"
          onClick={() => setOnlyMine((value) => !value)}
          aria-pressed={showingMine}
          className={`min-h-11 self-start rounded-full border px-4 text-sm ${
            showingMine
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
          }`}
        >
          My favorites ({favoriteCount})
        </button>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {bottles.length === 0
            ? "Nothing in the cellar yet."
            : showingMine && filtered.length > 0
              ? "None of your favorites match these filters."
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
                {/* The full line, not the owner list's short one: this
                    row does not expand, so what is on its face is all a
                    guest ever sees. It was dropping the sub-region. */}
                <p className="text-sm text-zinc-500">{wineDetail(bottle)}</p>
              </div>
              <FavoriteButton bottle={bottle} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
