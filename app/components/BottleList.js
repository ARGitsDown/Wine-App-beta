"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { adjustBottleQuantity } from "@/app/actions";
import AddToFlight from "@/app/components/AddToFlight";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";
import { formatTastedDate } from "@/lib/tasting-date";

const stepperClass =
  "flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-sm leading-none disabled:opacity-40 dark:border-zinc-700";

// Adjusting the count is the most common thing you do to a bottle you
// already own, and it used to mean opening the bottle's page and saving a
// form. Inline here, it's one tap. Floors at 1 - see adjustBottleQuantity.
function QuantityStepper({ bottle }) {
  const [pending, startTransition] = useTransition();

  function step(delta) {
    startTransition(() => adjustBottleQuantity(bottle.id, delta));
  }

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <span>Qty:</span>
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={pending || bottle.quantity <= 1}
        aria-label={`Decrease quantity of ${bottle.producer}`}
        className={stepperClass}
      >
        −
      </button>
      <span className="min-w-4 text-center tabular-nums text-zinc-600 dark:text-zinc-300">
        {bottle.quantity}
      </span>
      <button
        type="button"
        onClick={() => step(1)}
        disabled={pending}
        aria-label={`Increase quantity of ${bottle.producer}`}
        className={stepperClass}
      >
        +
      </button>
    </div>
  );
}

// `flights` is how a list opts into the add-to-a-tasting control: the cellar
// passes the open flights, everything else passes nothing and the control
// never renders. A flight is a queue of bottles you can open, so it has no
// business on the wishlist, on history, or on a guest's view.
export default function BottleList({ bottles, emptyMessage, flights = null }) {
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
                {WINE_COLOR_SWATCH[bottle.wineColor] && (
                  <span
                    className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle ${WINE_COLOR_SWATCH[bottle.wineColor]}`}
                    title={bottle.wineColor}
                  />
                )}
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
              <div className="flex gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                {bottle.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bottle.photoUrl}
                    alt={`Label photo for ${bottle.producer}`}
                    className="h-20 w-16 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-800"
                  />
                )}
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-zinc-500">
                    {[bottle.variety, bottle.region, bottle.subRegion, bottle.country]
                      .filter(Boolean)
                      .join(" · ") || "No variety/region set"}
                  </div>
                  {/* Only the Tasting notes page asks getBottles for this,
                      so only that page renders it - everywhere else
                      `latestNote` is absent rather than null and this stays
                      out of the way entirely. Until it existed, the page
                      named after tasting notes showed none of them: reading
                      one meant opening the bottle's own page. */}
                  {bottle.latestNote && (
                    <div className="flex flex-col gap-0.5 border-l-2 border-zinc-200 pl-3 dark:border-zinc-700">
                      <p className="text-sm italic text-zinc-600 dark:text-zinc-300">
                        &ldquo;{bottle.latestNote.note}&rdquo;
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatTastedDate(bottle.latestNote.tastedAt)}
                        {bottle.noteCount > 1 &&
                          ` \u00b7 most recent of ${bottle.noteCount}`}
                      </p>
                    </div>
                  )}

                  {bottle.favoritedBy?.length > 0 && (
                    <div className="text-xs text-zinc-500">
                      ❤️ Favorited by {bottle.favoritedBy.join(", ")}
                    </div>
                  )}
                  {/* History is a record of what's gone, so its count is
                      not something to nudge up and down after the fact. */}
                  {bottle.status === "consumed" ? (
                    <div className="text-xs text-zinc-400">Qty: {bottle.quantity}</div>
                  ) : (
                    <QuantityStepper bottle={bottle} />
                  )}
                  {flights !== null && bottle.status === "inventory" && (
                    <AddToFlight bottleId={bottle.id} flights={flights} />
                  )}
                  <Link
                    href={`/bottles/${bottle.id}`}
                    className="self-start text-sm text-zinc-500 underline underline-offset-2"
                  >
                    View full details →
                  </Link>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
