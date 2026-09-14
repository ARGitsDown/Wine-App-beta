"use client";

import { useMemo, useState, useTransition } from "react";
import { addBottleToFlight } from "@/app/actions";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";

// Searching happens in memory over the inventory the server already sent,
// the same trade the filter bar makes: typing narrows the list instantly
// instead of waiting on a round trip per keystroke.
export default function FlightBottlePicker({ flightId, bottles, defaultOpen = false }) {
  // Owned here, not by the server. Every add revalidates the flight page,
  // and an `open` prop recomputed from the new pick count snapped the panel
  // shut the moment you used it.
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);
  // Which bottle is mid-add, not merely "an add is happening": one shared
  // pending flag disabled every row's button at once, so adding two wines
  // in a row meant waiting on the first before the second would respond.
  const [addingId, setAddingId] = useState(null);
  const [, startTransition] = useTransition();

  const searchable = useMemo(
    () =>
      bottles.map((bottle) => ({
        ...bottle,
        haystack: [
          bottle.producer,
          bottle.bottling,
          bottle.vintage,
          bottle.type,
          bottle.variety,
          bottle.region,
          bottle.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      })),
    [bottles]
  );

  const term = query.trim().toLowerCase();
  // Capped, not because the list is expensive to render but because an
  // unfiltered cellar would bury the search box under hundreds of rows.
  const matches = (term ? searchable.filter((b) => b.haystack.includes(term)) : searchable).slice(
    0,
    12
  );

  function add(bottleId) {
    setError(null);
    setAddingId(bottleId);
    startTransition(async () => {
      const result = await addBottleToFlight(flightId, bottleId);
      if (result?.error) setError(result.error);
      setAddingId(null);
    });
  }

  const body =
    bottles.length === 0 ? (
      <p className="text-sm text-zinc-500">
        Every bottle in your inventory is already in this flight.
      </p>
    ) : (
      <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your inventory…"
        aria-label="Search your inventory"
        className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {matches.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing in inventory matches that.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {matches.map((bottle) => (
            <li key={bottle.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {WINE_COLOR_SWATCH[bottle.wineColor] && (
                  <span
                    className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${WINE_COLOR_SWATCH[bottle.wineColor]}`}
                    title={bottle.wineColor}
                  />
                )}
                {bottle.producer}
                {bottle.bottling ? ` “${bottle.bottling}”` : ""}
                {bottle.vintage ? ` ${bottle.vintage}` : ""}
                {bottle.type ? ` — ${bottle.type}` : ""}
              </span>
              <button
                type="button"
                onClick={() => add(bottle.id)}
                disabled={addingId === bottle.id}
                className="shrink-0 rounded border border-zinc-300 px-2 py-0.5 text-xs disabled:opacity-50 dark:border-zinc-700"
              >
                {addingId === bottle.id ? "Adding…" : "Add"}
              </button>
            </li>
          ))}
        </ul>
      )}
        {!term && bottles.length > matches.length && (
          <p className="text-xs text-zinc-400">
            Showing {matches.length} of {bottles.length} — search to narrow it down.
          </p>
        )}
      </div>
    );

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <summary className="cursor-pointer font-medium">Add a bottle</summary>
      <div className="mt-3">{body}</div>
    </details>
  );
}
