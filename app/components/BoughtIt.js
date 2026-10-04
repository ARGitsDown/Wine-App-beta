"use client";

import { useState, useTransition } from "react";
import { markBought, undoBought } from "@/app/actions";
import { useUndo } from "@/app/components/UndoToast";
import Spinner from "@/app/components/Spinner";
import PurchaseFields from "@/app/components/PurchaseFields";
import { DEFAULT_CURRENCY } from "@/lib/lot-fields";

// "Bought it" on a wishlist wine: how many, what each cost and where it is
// (the same three questions as Add another purchase), then it is a cellar wine. The confirmation and its Undo live in the shared
// toast, not here: the move takes the row off the Wishlist and the next render
// unmounts this component along with it.
export default function BoughtIt({
  bottleId,
  quantity = 1,
  name = null,
  // A price the wishlist wine already carries (a shop price noted earlier) is
  // offered back, so skipping the box does not lose it.
  priceCents = null,
  priceCurrency = null,
  locationOptions = [],
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(String(quantity));
  const [price, setPrice] = useState(priceCents == null ? "" : (priceCents / 100).toFixed(2));
  const [currency, setCurrency] = useState(priceCurrency || DEFAULT_CURRENCY);
  const [place, setPlace] = useState("");
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const showUndo = useUndo();

  function submit(event) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await markBought(bottleId, { quantity: count, price, currency, location: place });
      if (result?.error) {
        setError(result.error);
        return;
      }
      showUndo(name ? `Moved ${name} to Cellar` : "Moved to Cellar", () => undoBought(bottleId, result));
    });
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Bought it
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <PurchaseFields
        count={count}
        onCount={setCount}
        price={price}
        onPrice={setPrice}
        currency={currency}
        onCurrency={setCurrency}
        place={place}
        onPlace={setPlace}
        priceLabel={
          priceCents == null ? "Paid per bottle (optional)" : "Paid per bottle (from your wishlist - change if different)"
        }
        locationOptions={locationOptions}
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Move to Cellar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Cancel
        </button>
        {pending && <Spinner label="Moving…" />}
      </div>
    </form>
  );
}
