"use client";

import { useState, useTransition } from "react";
import { markBought, undoBought } from "@/app/actions";
import { useUndo } from "@/app/components/UndoToast";
import Spinner from "@/app/components/Spinner";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/lot-fields";

const inputClass =
  "min-h-11 rounded border border-zinc-300 px-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

// "Bought it" on a wishlist wine: how many, and (optionally) what each cost,
// then it is a cellar wine. The confirmation and its Undo live in the shared
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
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(String(quantity));
  const [price, setPrice] = useState(priceCents == null ? "" : (priceCents / 100).toFixed(2));
  const [currency, setCurrency] = useState(priceCurrency || DEFAULT_CURRENCY);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const showUndo = useUndo();

  function submit(event) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await markBought(bottleId, { quantity: count, price, currency });
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          How many
          <input
            type="number"
            min="1"
            max="999"
            inputMode="numeric"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            className={`${inputClass} w-20`}
          />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span id={`bought-price-${bottleId}`}>{priceCents == null ? "Paid per bottle (optional)" : "Paid per bottle (from your wishlist - change if different)"}</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-labelledby={`bought-price-${bottleId}`}
              className={`${inputClass} w-24`}
              placeholder="24.50"
            />
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              aria-label="Currency"
              className={inputClass}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
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
