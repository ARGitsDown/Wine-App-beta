"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { removePairingPickFromWishlist, setPairingPickDecision } from "@/app/actions";
import { CellarIcon, TastingHistoryIcon } from "@/app/components/icons";
import { STATUS_LOOK } from "@/lib/status-look";

// The choice for one wine in a saved pairing: Drink or Hold, or neither
// (undecided, the default - tapping the chosen one again goes back to it).
// Two tiles the way Scan's "Save to" picker does it, in the colours of where
// the wine ends up: Drink wears the Tasted look, Hold the Cellar look.
//
// Optimistic: the tile changes the instant it is tapped and the server
// catches up (or the tile snaps back with a message if it could not).
//
// A wine that is not owned (`notOwned`) is handled in words, because choosing
// Drink does something the tiles do not show: it puts the wine on the
// wishlist. One status line above the tiles tells the whole story, and it is
// always one line in the same place, so nothing moves when it changes:
//   before:           "Choosing Drink also adds it to your wishlist."
//   Drink chosen:     "On your wishlist ->"
//   Drink cleared:    "Still on your wishlist - Remove"  (clearing Drink
//                     deliberately leaves the wine; this says so)
//   Drink chosen, but the wishlist wine has since been deleted:
//                     "Not on your wishlist - Add"
// `wishlistBottleId` is the wishlist wine this pick is linked to, if any.
const OPTIONS = [
  { value: "drink", label: "Drink", Icon: TastingHistoryIcon, accent: STATUS_LOOK.consumed.accent },
  { value: "hold", label: "Hold", Icon: CellarIcon, accent: STATUS_LOOK.inventory.accent },
];

export default function PairingDecision({ pickId, decision, wineLabel, notOwned = false, wishlistBottleId = null }) {
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(decision ?? null);

  // `force` is for "Add": the pick already says Drink, and the tap must send
  // Drink again (not clear it) so the wishlist wine is made.
  function choose(value, force = false) {
    const next = !force && shown === value ? null : value;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      setShown(next);
      const result = await setPairingPickDecision(pickId, next);
      if (result?.error) setError(result.error);
      else if (result?.kind === "owned") setNotice("You already have this wine in your cellar.");
    });
  }

  // Its own two-step control rather than ConfirmButton: this action can
  // refuse (a wine with notes or photos on it is left alone) and the person
  // has to be told why, which ConfirmButton has no way to show.
  function removeFromWishlist() {
    setError(null);
    startTransition(async () => {
      const result = await removePairingPickFromWishlist(pickId);
      if (result?.error) setError(result.error);
      setConfirming(false);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {notOwned && (
        <div aria-live="polite" className="text-xs text-zinc-500">
          {!wishlistBottleId && shown !== "drink" && <p>Choosing Drink also adds it to your wishlist.</p>}
          {!wishlistBottleId && shown === "drink" && (
            <p className="flex flex-wrap items-center gap-x-2">
              Not on your wishlist &middot;
              <button
                type="button"
                onClick={() => choose("drink", true)}
                className="flex min-h-11 items-center underline underline-offset-2"
              >
                Add
              </button>
            </p>
          )}
          {wishlistBottleId && shown === "drink" && (
            <p>
              <Link
                href={`/bottles/${wishlistBottleId}`}
                className="-my-2 inline-flex min-h-11 items-center underline underline-offset-2"
              >
                &#10003; On your wishlist &rarr;
              </Link>
            </p>
          )}
          {wishlistBottleId && shown !== "drink" && (
            <p className="flex flex-wrap items-center gap-x-2">
              {confirming ? (
                <>
                  Take it off your wishlist?
                  <button
                    type="button"
                    onClick={removeFromWishlist}
                    className="flex min-h-11 items-center rounded border border-red-300 px-3 text-xs text-red-600 dark:border-red-900 dark:text-red-400"
                  >
                    Yes, remove it
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="flex min-h-11 items-center underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  Still on your wishlist &middot;
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="flex min-h-11 items-center underline underline-offset-2"
                  >
                    Remove
                  </button>
                </>
              )}
            </p>
          )}
        </div>
      )}
      {/* Toggle buttons, not radios: tapping the chosen one again clears it, which
          a radio group cannot do, so the screen reader is told "pressed" rather
          than "selected one of two". The selected tile also carries a check mark,
          so the state is not only a colour. */}
      <div role="group" aria-label={`Decision for ${wineLabel}`} className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map((option) => {
          const selected = shown === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(option.value)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 ${
                selected
                  ? `border-transparent font-medium ${option.accent}`
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              <option.Icon className="h-4 w-4 shrink-0" />
              {option.label}
              {selected && <span aria-hidden="true">&#10003;</span>}
            </button>
          );
        })}
      </div>
      {notice && (
        <p role="status" className="text-xs text-green-700 dark:text-green-400">
          &#10003; {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
