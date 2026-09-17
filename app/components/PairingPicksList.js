"use client";

import { useState } from "react";
import Link from "next/link";

// A pairing's picks, collapsed to one line each and expanding to the full
// reason on tap - the same pattern BottleList already uses for a cellar
// row (BACKLOG #28), lifted here rather than reused directly: a pick isn't
// a bottle (it may have no bottle at all, and carries a dish and a reason
// BottleList knows nothing about), so this is its own small component
// built the same way rather than a shared one stretched to cover both.
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
            {/* Same three-column shape as BottleList's row: a marker
                column, a flex-1 main column (dish above the wine name,
                since a card can carry both), and a trailing column for the
                one badge that says whether there's still a bottle behind
                this. */}
            <button
              type="button"
              onClick={() => toggle(pick.id)}
              aria-expanded={expanded}
              className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span aria-hidden="true" className="shrink-0 pt-0.5 text-zinc-400">
                {expanded ? "▾" : "▸"}
              </span>
              <span className="min-w-0 flex-1">
                {pick.dish && (
                  <span className="mb-1 inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                    {pick.dish}
                  </span>
                )}
                {/* The full heading here, not the short wineName the list
                    page uses - this row isn't sharing space with dish
                    names from other picks, so there's room for it. */}
                <span className="block font-medium">{pick.wineLabel}</span>
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
                {/* The one navigable link, here rather than on the
                    collapsed row - an <a> nested inside the row's own
                    toggle <button> would be invalid HTML and an ambiguous
                    tap target, the same reason BottleList's own
                    "View full details" link lives in its expanded content
                    and not its collapsed row. */}
                {pick.bottle && (
                  <Link
                    href={`/bottles/${pick.bottle.id}`}
                    className="self-start text-sm text-zinc-500 underline underline-offset-2"
                  >
                    View full details →
                  </Link>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
