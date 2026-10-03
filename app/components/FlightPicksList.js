"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  markFlightPickConsumed,
  markFlightPickConsumedAndNote,
  unmarkFlightPickConsumed,
  removeFlightPick,
  moveFlightPick,
} from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
import { wineDetailOrNone } from "@/lib/wine-origin";
import { drinkWindowLabel } from "@/lib/drink-window";

// The two actions on a wine that has not been tasted yet - Tasted, and With
// note (which also marks it tasted) - live behind the row, not on it, so the
// name has the whole line. Slide the row left (or tap the ‹ at its right edge,
// which is the way in for anyone who isn't swiping) and they are there, big
// and labelled. See markFlightPickConsumed and markFlightPickConsumedAndNote.
// How far a row slides to show its two actions: two 88px buttons, each the
// full height of the row - far bigger than anything that could share a line
// with a wine's name, and only there when asked for.
const ACTION_W = 176;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}
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
  // Which row has its actions showing - one at a time - and, mid-gesture, how
  // far the finger has dragged it. The gesture itself is only tracked once it
  // is clearly horizontal, so vertical scrolling through a long flight is
  // never fought over (the rows also say touch-action: pan-y).
  const [openId, setOpenId] = useState(null);
  const [drag, setDrag] = useState(null);
  const gesture = useRef(null);
  const justDragged = useRef(false);

  function onPointerDown(event, pick) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gesture.current = {
      id: pick.id,
      x: event.clientX,
      y: event.clientY,
      base: openId === pick.id ? -ACTION_W : 0,
      horizontal: false,
    };
  }

  function onPointerMove(event) {
    const g = gesture.current;
    if (!g) return;
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    if (!g.horizontal) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        g.horizontal = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      } else {
        return;
      }
    }
    g.last = Math.max(-ACTION_W, Math.min(0, g.base + dx));
    setDrag({ id: g.id, x: g.last });
  }

  function onPointerUp() {
    const g = gesture.current;
    gesture.current = null;
    if (!g || !g.horizontal) return;
    // The click that follows a drag must not also expand the row.
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 60);
    setOpenId(g.last < -ACTION_W / 2 ? g.id : openId === g.id ? null : openId);
    setDrag(null);
  }

  function onPointerCancel() {
    gesture.current = null;
    setDrag(null);
  }

  function toggle(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const anyUntasted = picks.some((pick) => !pick.consumed);

  return (
    <>
    {anyUntasted && (
      <p className="flex flex-wrap gap-x-4 text-xs text-zinc-500">
        <span>Slide a wine left, or tap &lsaquo;, for Tasted or With note</span>
      </p>
    )}
    <ol className="flex flex-col gap-2">
      {picks.map((pick, index) => {
        const expanded = expandedIds.has(pick.id);
        const facts = [pick.bottle.wineColor, pick.bottle.abv != null ? `${pick.bottle.abv}% ABV` : null]
          .filter(Boolean)
          .join(" · ");
        const windowLabel = drinkWindowLabel(pick.bottle);
        const isOpen = !pick.consumed && openId === pick.id;
        const dragging = drag?.id === pick.id;
        const rowX = dragging ? drag.x : isOpen ? -ACTION_W : 0;
        return (
          <li
            key={pick.id}
            className={`rounded-lg border ${
              pick.consumed
                ? "border-zinc-200 opacity-60 dark:border-zinc-800"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className={`relative overflow-hidden ${expanded ? "rounded-t-lg" : "rounded-lg"}`}>
              {!pick.consumed && (
                <div
                  className="absolute inset-y-0 right-0 flex"
                  style={{ width: ACTION_W }}
                  inert={!isOpen}
                >
                  <form
                    action={markFlightPickConsumed.bind(null, pick.id)}
                    className="flex h-full flex-1"
                  >
                    <button
                      type="submit"
                      aria-label={`${tastedLabel(pick.bottle)}: ${bottleHeader(pick.bottle)}`}
                      className="flex h-full w-full flex-col items-center justify-center gap-1 bg-green-700 text-sm font-medium text-white"
                    >
                      <CheckIcon />
                      Tasted
                    </button>
                  </form>
                  <form
                    action={markFlightPickConsumedAndNote.bind(null, pick.id)}
                    className="flex h-full flex-1"
                  >
                    <button
                      type="submit"
                      aria-label={`Add a tasting note, and mark tasted: ${bottleHeader(pick.bottle)}`}
                      className="flex h-full w-full flex-col items-center justify-center gap-1 bg-blue-700 text-sm font-medium text-white"
                    >
                      <PenIcon />
                      With note
                    </button>
                  </form>
                </div>
              )}
              <div
                className="relative flex min-h-14 items-center gap-1.5 bg-background pr-1"
                style={{
                  transform: `translateX(${rowX}px)`,
                  transition: dragging ? "none" : "transform 160ms ease-out",
                  touchAction: "pan-y",
                }}
                onPointerDown={!pick.consumed ? (event) => onPointerDown(event, pick) : undefined}
                onPointerMove={!pick.consumed ? onPointerMove : undefined}
                onPointerUp={!pick.consumed ? onPointerUp : undefined}
                onPointerCancel={!pick.consumed ? onPointerCancel : undefined}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (justDragged.current) return;
                    if (isOpen) setOpenId(null);
                    else toggle(pick.id);
                  }}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-start gap-1.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span aria-hidden="true" className="shrink-0 pt-0.5 text-zinc-400">
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span className="min-w-0 flex-1 font-medium">
                    {index + 1}. {bottleHeader(pick.bottle)}
                    {pick.bottle.type ? ` — ${pick.bottle.type}` : ""}
                    {/* The one thing the dropped "Flight" pill said that a row
                        still needs: a cellar wine with several bottles loses
                        only one to "Tasted". */}
                    {!pick.consumed && !pick.originFlightOnly && pick.bottle.quantity > 1 && (
                      <span className="ml-1.5 text-xs font-normal text-zinc-500">
                        {pick.bottle.quantity} bottles
                      </span>
                    )}
                  </span>
                  {pick.consumed && (
                    <span className="shrink-0 text-sm font-medium text-green-700 dark:text-green-400">
                      ✓ Tasted
                    </span>
                  )}
                </button>
                {/* The way to the actions without a swipe: a tap target in
                    its own right, and the hint that there is something
                    behind the row. */}
                {!pick.consumed && (
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : pick.id)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Hide" : "Show"} Tasted and With note for ${bottleHeader(pick.bottle)}`}
                    className="flex h-11 w-8 shrink-0 items-center justify-center text-2xl leading-none text-zinc-400"
                  >
                    {isOpen ? "›" : "‹"}
                  </button>
                )}
              </div>
            </div>

            {expanded && (
              <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
                {/* Opening a wine shows the wine: what the cellar's own
                    expanded row shows, so nobody has to leave the flight to
                    find out what they are about to pour. The ordering and
                    removal controls come after it. */}
                <div className="flex gap-3">
                  {pick.bottle.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pick.bottle.photoUrl}
                      alt={`Label photo for ${pick.bottle.producer}`}
                      className="h-20 w-16 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-800"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <p>{wineDetailOrNone(pick.bottle)}</p>
                    {facts && <p className="text-zinc-500">{facts}</p>}
                    {windowLabel && <p className="text-zinc-500">{windowLabel}</p>}
                  </div>
                </div>
                {pick.bottle.criticNotes && (
                  <p className="line-clamp-3 text-xs text-zinc-500">
                    From the label or sheet: {pick.bottle.criticNotes}
                  </p>
                )}
                {/* A pick added by hand has no argument attached to it -
                    only a place in the running order. */}
                {pick.reason && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{pick.reason}</p>
                )}
                {/* ?flight= carries where you came from, so the wine's page can
                    say so and offer a Back that names this flight. */}
                <Link
                  href={`/bottles/${pick.bottle.id}?flight=${flightId}`}
                  className="-my-2 flex min-h-11 items-center self-start text-sm text-zinc-500 underline underline-offset-2"
                >
                  Photos, notes and editing →
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

                {pick.consumed && (
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Marking a pick tasted moves the bottle somewhere real -
                        Cellar quantity down, or straight to Tasting notes for
                        a flight-only wine (BACKLOG #29 and #36) - so a mis-tap
                        needs a way back. Undo reverses exactly what that tap
                        did (unmarkFlightPickConsumed). */}
                    <form action={unmarkFlightPickConsumed.bind(null, pick.id)}>
                      <button type="submit" className={undoButtonClass}>
                        Undo
                      </button>
                    </form>
                    {/* The note icon is only on wines still to taste, since
                        it also marks them tasted; this is the way to add one
                        afterwards. The id, not the text: the prefill then
                        names whichever of title/summary the flight has. */}
                    <Link
                      href={`/bottles/${pick.bottle.id}?tastingFlight=${flightId}`}
                      className="text-sm text-zinc-500 underline underline-offset-2"
                    >
                      Add a tasting note →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
    </>
  );
}
