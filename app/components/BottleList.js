"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { adjustBottleQuantity } from "@/app/actions";
import AddToFlight from "@/app/components/AddToFlight";
import BoughtIt from "@/app/components/BoughtIt";
import TastedControls from "@/app/components/TastedControls";
import { WINE_COLOR_SWATCH } from "@/lib/wine-colors";
import { wineDetailOrNone, wineOrigin } from "@/lib/wine-origin";
import { drinkWindowLabel } from "@/lib/drink-window";
import { lotLine, wineSiblingKey } from "@/lib/lot-fields";
import { wineLabel } from "@/lib/bottle-trash";
import { formatTastedDate } from "@/lib/tasting-date";

const stepperClass =
  "flex h-11 w-11 items-center justify-center rounded border border-zinc-300 text-sm leading-none disabled:opacity-40 dark:border-zinc-700";

// Adjusting the count is the most common thing you do to a bottle you
// already own, and it used to mean opening the bottle's page and saving a
// form. Inline here, it's one tap. Floors at 1 - see adjustBottleQuantity.
//
// Labelled "Correct the count", not "Qty:", so it doesn't read like the
// answer to "I drank one" - that's TastedControls below it, a different
// control for a different question (BACKLOG #29 finding 3).
function QuantityStepper({ bottle }) {
  const [pending, startTransition] = useTransition();

  function step(delta) {
    startTransition(() => adjustBottleQuantity(bottle.id, delta));
  }

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <span>Correct the count:</span>
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
export default function BottleList({
  bottles,
  emptyMessage,
  flights = null,
  // How many lots of each wine the WHOLE list holds, keyed by wineSiblingKey.
  // A filtered view passes the full list's counts: counting only the rows on
  // screen made a wine look like a single lot as soon as a filter hid the
  // other one.
  lotCounts = null,
}) {
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

  // A wine held as several lots (bought twice at different prices, or split
  // across two shelves) shows how its lots differ on each row, since they
  // otherwise read as the same wine listed twice.
  const lotsOfWine = new Map(lotCounts ? Object.entries(lotCounts) : []);
  if (!lotCounts) {
    for (const bottle of bottles) {
      const key = wineSiblingKey(bottle);
      lotsOfWine.set(key, (lotsOfWine.get(key) ?? 0) + 1);
    }
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {bottles.map((bottle) => {
        const severalLots = bottle.status === "inventory" && lotsOfWine.get(wineSiblingKey(bottle)) > 1;
        const expanded = expandedIds.has(bottle.id);
        // Origin and the drinking window share one quiet line rather than
        // each getting their own - both are worth scanning by, neither is
        // worth a whole extra row across a cellar of hundreds (BACKLOG #29
        // finding 1). Same "say nothing when there's nothing to say" rule
        // wineOrigin() already follows for a bottle with no region.
        // Where it is and a non-standard size ride on the same line; price
        // does not (not what a list is scanned by).
        const detailLine = [
          wineOrigin(bottle),
          drinkWindowLabel(bottle),
          severalLots ? null : lotLine(bottle, { withPrice: false }),
        ]
          .filter(Boolean)
          .join(" · ");
        // What tells this lot from the wine's other lots goes on a line of its
        // own, first: at phone width it would otherwise wrap off the end of the
        // region and window.
        const lotDetail = severalLots
          ? [`${bottle.quantity} bottle${bottle.quantity === 1 ? "" : "s"}`, lotLine(bottle)]
              .filter(Boolean)
              .join(" · ")
          : null;
        return (
          <li
            key={bottle.id}
            className="rounded-lg border border-zinc-200 dark:border-zinc-800"
          >
            {/* The marker is its own column now rather than sitting
                inside the name: the row has two lines of text, and an
                indent that has to clear a triangle and a colour dot of
                different widths is a guess that goes wrong on half the
                rows. */}
            <button
              type="button"
              onClick={() => toggle(bottle.id)}
              aria-expanded={expanded}
              className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span aria-hidden="true" className="shrink-0 text-zinc-400">
                {expanded ? "▾" : "▸"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">
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
                {/* Where the wine is from, and when to drink it, on the
                    face of the row rather than a tap inside it: scanning a
                    list for "something from the Loire" - or for what's
                    actually near its window, the reason "Drink soon"
                    sorting exists - was opening rows one at a time.
                    Quieter than the name because it is what you scan by,
                    not what you read. Nothing at all when there's nothing
                    on file - a blank line is not information, and the
                    expanded panel already says so in words. */}
                {lotDetail && (
                  <span className="mt-0.5 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {lotDetail}
                  </span>
                )}
                {detailLine && (
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {detailLine}
                  </span>
                )}
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
                    {wineDetailOrNone(bottle)}
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
                  {/* The stepper above corrects a count (bought two more,
                      miscounted) - a different question from "I drank
                      one", which used to only have an answer on the
                      bottle's own page (BACKLOG #29 finding 3). Same
                      component and the same markOneTasted the bottle page
                      uses, not a second implementation - it already
                      self-gates to nothing on a wishlist row. */}
                  {bottle.status === "wishlist" && (
                    <BoughtIt
                      bottleId={bottle.id}
                      quantity={bottle.quantity}
                      name={wineLabel(bottle)}
                      priceCents={bottle.pricePaidCents}
                      priceCurrency={bottle.priceCurrency}
                    />
                  )}
                  {bottle.status === "inventory" && (
                    <TastedControls
                      bottleId={bottle.id}
                      status={bottle.status}
                      quantity={bottle.quantity}
                      name={wineLabel(bottle)}
                    />
                  )}
                  {flights !== null && bottle.status === "inventory" && (
                    <AddToFlight bottleId={bottle.id} flights={flights} />
                  )}
                  <Link
                    href={`/bottles/${bottle.id}`}
                    className="flex min-h-11 items-center self-start text-sm text-zinc-500 underline underline-offset-2"
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
