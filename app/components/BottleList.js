"use client";

import { useState } from "react";
import Link from "next/link";

export default function BottleList({ bottles, emptyMessage }) {
  const [expandedIds, setExpandedIds] = useState(new Set());

  function toggle(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (bottles.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {bottles.map((bottle) => {
        const expanded = expandedIds.has(bottle.id);
        return (
          <li
            key={bottle.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800"
          >
            <button
              type="button"
              onClick={() => toggle(bottle.id)}
              aria-expanded={expanded}
              className="flex w-full items-baseline justify-between gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="font-medium">
                <span className="mr-1.5 inline-block text-zinc-400">
                  {expanded ? "▾" : "▸"}
                </span>
                {bottle.producer}
                {bottle.bottling ? ` “${bottle.bottling}”` : ""}
                {bottle.vintage ? ` ${bottle.vintage}` : ""}
                {bottle.type ? ` — ${bottle.type}` : ""}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {bottle.favoritedBy?.length > 0 && (
                  <span
                    className="text-sm"
                    title={`Favorited by ${bottle.favoritedBy.join(", ")}`}
                  >
                    ❤️ {bottle.favoritedBy.length}
                  </span>
                )}
                {bottle.averageRating !== null && (
                  <span className="text-sm text-zinc-500">
                    {bottle.averageRating.toFixed(1)} ★
                  </span>
                )}
              </span>
            </button>

            {expanded && (
              <div className="flex flex-col gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="text-sm text-zinc-500">
                  {[bottle.variety, bottle.region, bottle.subRegion, bottle.country]
                    .filter(Boolean)
                    .join(" · ") || "No variety/region set"}
                </div>
                {bottle.favoritedBy?.length > 0 && (
                  <div className="text-xs text-zinc-400">
                    ❤️ Favorited by {bottle.favoritedBy.join(", ")}
                  </div>
                )}
                <div className="text-xs text-zinc-400">
                  Qty: {bottle.quantity}
                </div>
                <Link
                  href={`/bottles/${bottle.id}`}
                  className="self-start text-sm text-zinc-500 underline underline-offset-2"
                >
                  View full details →
                </Link>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
