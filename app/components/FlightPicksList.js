"use client";

import { useState } from "react";
import Link from "next/link";
import {
  markFlightPickConsumed,
  markFlightPickConsumedAndNote,
  unmarkFlightPickConsumed,
  removeFlightPick,
  moveFlightPick,
} from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import StatusBadge from "@/app/components/StatusBadge";

// The two taps on a wine that has not been tasted yet, shown on its collapsed
// row. Equal weight, side by side: which one is wanted depends on the wine,
// not on a default, and both are one tap (see markFlightPickConsumed and
// markFlightPickConsumedAndNote).
const quickButtonClass =
  "flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-300 px-2 text-sm font-medium dark:border-zinc-700";
const undoButtonClass =
  "min-h-11 rounded-lg border border-zinc-300 px-3 text-sm dark:border-zinc-700";
// 44px, not the 24px this used to be (BACKLOG #29) - reordering a flight is
// a precision task done one-handed, possibly holding a bottle, and the tab
// bar already holds the line that a tap target is thumb-sized or it's
// decoration.
const reorderButtonClass =
  "flex h-11 w-11 items-center justify-center rounded border border-zinc-300 leading-none disabled:opacity-30 dark:border-zinc-700";
const removeLinkClass =
  "text-red-600 underline underline-offset-2 dark:text-red-400";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
}

// Matches the bottle page's own wording exactly (BACKLOG #29) - now that
// marking a pick tasted decrements the same `quantity`, the button that
// does it should read the same way everywhere it appears.
function tastedLabel(bottle) {
  return bottle.quantity > 1 ? `Tasted one — ${bottle.quantity - 1} left` : "Tasted";
}

// Each pick collapsed to its number and title, expanding on tap to reveal
// everything else about it - the reason, the order controls, tasted/note.
// A collapsed pick used to still carry the order/remove/tasted rows below
// the toggle, which meant the collapse bought almost no vertical space; a
// flight of six still didn't fit on a phone. Moving all of it inside the
// expanded panel, matching PairingPicksList and BottleList's own row, is
// what actually makes the collapse worth doing.
export default function FlightPicksList({ flightId, picks }) {
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
    <ol className="flex flex-col gap-3">
      {picks.map((pick, index) => {
        const expanded = expandedIds.has(pick.id);
        return (
          <li
            key={pick.id}
            className={`rounded-lg border ${
              pick.consumed
                ? "border-zinc-200 opacity-60 dark:border-zinc-800"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <button
              type="button"
              onClick={() => toggle(pick.id)}
              aria-expanded={expanded}
              className="flex w-full items-start gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span aria-hidden="true" className="shrink-0 pt-0.5 text-zinc-400">
                {expanded ? "▾" : "▸"}
              </span>
              <span className="min-w-0 flex-1 font-medium">
                {index + 1}. {bottleHeader(pick.bottle)}
                {pick.bottle.type ? ` — ${pick.bottle.type}` : ""}
                {/* "Tasted" means something different for these than for
                    a cellar wine here (Cellar quantity down vs. straight
                    to Tasted, see markFlightPickConsumed) - the collapsed
                    row said nothing about which was which until now (a
                    UX review, 2026-09-27). */}
                {pick.originFlightOnly && (
                  <StatusBadge status="flight" className="ml-1.5 align-middle" />
                )}
              </span>
              {pick.consumed && (
                <span className="shrink-0 text-sm font-medium text-green-700 dark:text-green-400">
                  ✓ Tasted
                </span>
              )}
            </button>

            {/* Where the flight is actually used - at the table, a bottle at a
                time - so tasting a wine is not behind an expand. A tasted
                wine's row stays a single line. */}
            {!pick.consumed && (
              <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                <form action={markFlightPickConsumed.bind(null, pick.id)}>
                  <button
                    type="submit"
                    aria-label={`${tastedLabel(pick.bottle)}: ${bottleHeader(pick.bottle)}`}
                    className={quickButtonClass}
                  >
                    {tastedLabel(pick.bottle)}
                  </button>
                </form>
                <form action={markFlightPickConsumedAndNote.bind(null, pick.id)}>
                  <button
                    type="submit"
                    aria-label={`Tasted, and add a tasting note: ${bottleHeader(pick.bottle)}`}
                    className={quickButtonClass}
                  >
                    Tasted + note
                  </button>
                </form>
              </div>
            )}

            {expanded && (
              <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                {/* A pick added by hand has no argument attached to it -
                    only a place in the running order. */}
                {pick.reason && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{pick.reason}</p>
                )}
                <Link
                  href={`/bottles/${pick.bottle.id}`}
                  className="self-start text-sm text-zinc-500 underline underline-offset-2"
                >
                  View full details →
                </Link>

                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
                  <span>Order:</span>
                  <form action={moveFlightPick.bind(null, pick.id, "up")}>
                    <button
                      type="submit"
                      disabled={index === 0}
                      aria-label={`Move ${bottleHeader(pick.bottle)} earlier`}
                      className={reorderButtonClass}
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveFlightPick.bind(null, pick.id, "down")}>
                    <button
                      type="submit"
                      disabled={index === picks.length - 1}
                      aria-label={`Move ${bottleHeader(pick.bottle)} later`}
                      className={reorderButtonClass}
                    >
                      ↓
                    </button>
                  </form>
                  <ConfirmButton
                    action={removeFlightPick.bind(null, pick.id)}
                    label="Remove from flight"
                    confirmLabel="Yes, remove"
                    warning={
                      pick.originFlightOnly
                        ? "This bottle was never in your cellar - removing it leaves it unlinked from any flight."
                        : "Removes this wine from the flight. It stays in your cellar."
                    }
                    className={removeLinkClass}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {pick.consumed ? (
                    // Marking a pick tasted now moves the bottle somewhere
                    // real - Cellar quantity down, or straight to Tasted for
                    // a flight-only wine (BACKLOG #29 and #36) - so a
                    // mis-tap needs a way back. Undo reverses exactly what
                    // that tap did (unmarkFlightPickConsumed), not a
                    // separate hand-rolled correction, and lands the bottle
                    // back wherever it actually started either way.
                    <form action={unmarkFlightPickConsumed.bind(null, pick.id)}>
                      <button type="submit" className={undoButtonClass}>
                        Undo
                      </button>
                    </form>
                  ) : null}
                  {/* The id, not the text: the note prefill then renders
                      whichever of title/summary this flight actually has,
                      instead of freezing a copy into the URL. Left visible
                      either way - tasted or not is a separate question from
                      whether there's a note to write. */}
                  <Link
                    href={`/bottles/${pick.bottle.id}?tastingFlight=${flightId}`}
                    className="self-center text-sm text-zinc-500 underline underline-offset-2"
                  >
                    Log a tasting note →
                  </Link>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
