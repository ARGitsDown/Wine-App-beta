"use client";

import { useState } from "react";
import Link from "next/link";

// A pairing's picks. The wine name is a direct link into its own bottle
// page - that's the point of a kept pairing, going straight from "what to
// drink" to the bottle itself - with a separate toggle below it for the
// reason and (for a gap suggestion) region/country, which don't need to be
// on screen until asked for. Not the same button-does-both pattern
// BottleList/FlightPicksList use, because nesting the navigable <Link>
// inside that toggle <button> would be invalid HTML.
export default function PairingPicksList({ picks }) {
  const [expandedIds, setExpandedIds] = useState(new Set());

  function toggle(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {picks.map((pick) => {
        const expanded = expandedIds.has(pick.id);
        return (
          <li
            key={pick.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800"
          >
            <div className="flex items-start gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                {pick.dish && (
                  <span className="mb-1 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {pick.dish}
                  </span>
                )}
                {/* The full heading here, not the short wineName the list
                    page uses - this row isn't sharing space with dish
                    names from other picks, so there's room for it. */}
                {pick.bottle ? (
                  <Link
                    href={`/bottles/${pick.bottle.id}`}
                    className="block font-medium underline underline-offset-2"
                  >
                    {pick.wineLabel}
                  </Link>
                ) : (
                  <span className="block font-medium">{pick.wineLabel}</span>
                )}
              </span>
              <span className="shrink-0">
                {/* Three states, and the label is the same in all of them
                    because it is a snapshot of how the wine read when this
                    was kept. What differs is whether there is still a
                    bottle to click through to, and why not. */}
                {pick.gap ? (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                    Not in your cellar
                  </span>
                ) : (
                  !pick.bottle && (
                    <span className="text-xs text-zinc-500">
                      No longer in your cellar
                    </span>
                  )
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={() => toggle(pick.id)}
              aria-expanded={expanded}
              className="flex w-full items-center gap-1 border-t border-zinc-200 px-4 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
              Why this wine?
            </button>

            {expanded && (
              <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                {pick.gap && (
                  <p className="text-sm text-zinc-500">
                    {[pick.gap.region, pick.gap.country].filter(Boolean).join(", ")}
                  </p>
                )}
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {pick.reason}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
