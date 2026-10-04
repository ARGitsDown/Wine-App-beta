"use client";

import { BOTTLE_STATUS } from "@/lib/bottle-status";
import { useId, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { addBottleToFlight } from "@/app/actions";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";
import StatusBadge from "@/app/components/StatusBadge";
import { ScanIcon } from "@/app/components/icons";

// Searching happens in memory over the cellar the server already sent,
// the same trade the filter bar makes: typing narrows the list instantly
// instead of waiting on a round trip per keystroke.
//
// `photoHref`, when given, puts the other way in - photographing the wines -
// on the same row as the one that opens this picker, rather than as a second
// full-width bar below it: the two answer the same question ("add something
// to this flight") and the page is mostly a list, so a row each was spending
// a screen's worth of height on what is one decision.
export default function FlightBottlePicker({ flightId, bottles, defaultOpen = false, photoHref = null }) {
  const panelId = useId();
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
      // Flight-only bottles first, stably within the producer order the
      // server already sent - this search is the recovery path for
      // exactly those (BACKLOG #38), and an unfiltered cellar of hundreds
      // could otherwise bury one past the 12-row cap before it's ever
      // seen (a UX review, 2026-09-27).
      [...bottles]
        .sort((a, b) => (a.status === BOTTLE_STATUS.FLIGHT ? 0 : 1) - (b.status === BOTTLE_STATUS.FLIGHT ? 0 : 1))
        .map((bottle) => ({
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
        Everything eligible is already in this flight.
      </p>
    ) : (
      <div className="flex flex-col gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your bottles…"
        aria-label="Search your bottles"
        className="rounded-lg border border-zinc-300 px-3 py-2.5 text-base dark:border-zinc-700 dark:bg-zinc-900"
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {matches.length === 0 ? (
        <p className="text-sm text-zinc-500">None of your bottles match that.</p>
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
                {/* Flags exactly the wines this search is the recovery
                    path for - unlinked and easy to mistake for an
                    ordinary cellar bottle otherwise (a UX review,
                    2026-09-27). */}
                {bottle.status === BOTTLE_STATUS.FLIGHT && (
                  <StatusBadge status={BOTTLE_STATUS.FLIGHT} className="ml-1.5" />
                )}
              </span>
              <button
                type="button"
                onClick={() => add(bottle.id)}
                disabled={addingId === bottle.id}
                className="min-h-11 shrink-0 rounded-lg border border-zinc-300 px-3 text-sm disabled:opacity-50 dark:border-zinc-700"
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

  const toggleClass =
    "flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700";

  return (
    <div className="flex flex-col gap-3">
      <div className={photoHref ? "grid grid-cols-2 gap-2" : ""}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`${toggleClass} ${photoHref ? "" : "w-full justify-start"}`}
        >
          <span aria-hidden="true" className="text-xs">
            {open ? "\u25BE" : "\u25B8"}
          </span>
          Add a bottle
        </button>
        {photoHref && (
          <Link href={photoHref} className={toggleClass}>
            <ScanIcon className="h-4 w-4" />
            Add by photo
          </Link>
        )}
      </div>
      {open && (
        <div id={panelId} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {body}
        </div>
      )}
    </div>
  );
}
