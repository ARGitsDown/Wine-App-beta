"use client";

import { useOptimistic, useState, useTransition } from "react";
import { removePairingPickFromWishlist, setPairingPickDecision } from "@/app/actions";
import ConfirmButton from "@/app/components/ConfirmButton";
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
// wishlist. Before the choice, a line above the tiles says so. Right after
// it, "Added to your wishlist." confirms it. And if Drink is later cleared,
// the wishlist wine stays (`wishlistBottleId` says it is still there), so a
// line says that and offers to remove it, rather than letting an undo look
// like it undid more than it did.
const OPTIONS = [
  { value: "drink", label: "Drink", Icon: TastingHistoryIcon, accent: STATUS_LOOK.consumed.accent },
  { value: "hold", label: "Hold", Icon: CellarIcon, accent: STATUS_LOOK.inventory.accent },
];

export default function PairingDecision({ pickId, decision, wineLabel, notOwned = false, wishlistBottleId = null }) {
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(decision ?? null);

  function choose(value) {
    const next = shown === value ? null : value;
    setError(null);
    setAdded(false);
    startTransition(async () => {
      setShown(next);
      const result = await setPairingPickDecision(pickId, next);
      if (result?.error) setError(result.error);
      else if (result?.wishlisted) setAdded(true);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {notOwned && !wishlistBottleId && (
        <p className="text-xs text-zinc-500">Choosing Drink also adds it to your wishlist.</p>
      )}
      <div role="radiogroup" aria-label={`Decision for ${wineLabel}`} className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map((option) => {
          const selected = shown === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(option.value)}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 ${
                selected
                  ? `border-transparent font-medium ${option.accent}`
                  : "border-zinc-200 text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-600"
              }`}
            >
              <option.Icon className="h-4 w-4 shrink-0" />
              {option.label}
            </button>
          );
        })}
      </div>
      {added && (
        <p role="status" className="text-xs text-green-700 dark:text-green-400">
          &#10003; Added to your wishlist.
        </p>
      )}
      {notOwned && wishlistBottleId && shown !== "drink" && (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
          Still on your wishlist &middot;
          <ConfirmButton
            action={removePairingPickFromWishlist.bind(null, pickId)}
            label="Remove"
            confirmLabel="Yes, remove it"
            warning="This takes the wine off your wishlist."
            className="flex min-h-11 items-center underline underline-offset-2"
            confirmClassName="rounded border border-red-300 px-3 py-1.5 text-xs text-red-600 dark:border-red-900 dark:text-red-400"
          />
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
