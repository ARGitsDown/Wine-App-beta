"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAnotherPurchase, undoAddedPurchase } from "@/app/actions";
import { useUndo } from "@/app/components/UndoToast";
import Spinner from "@/app/components/Spinner";
import { CURRENCIES, DEFAULT_CURRENCY, MAX_LOCATION } from "@/lib/lot-fields";

const inputClass =
  "min-h-11 rounded border border-zinc-300 px-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

// The same wine bought again (another price, another shelf) as its own lot. A
// small form rather than a one-tap copy: the count, the price and the place
// are exactly what differs, so they are asked for here and the new lot is
// created only on submit. The page stays where it is (any unsaved edit in
// Wine details above survives) and the shared Undo bar says what was added.
export default function AddPurchase({ bottleId, name, location = "", locationOptions = [] }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("1");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [place, setPlace] = useState(location);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const showUndo = useUndo();
  const router = useRouter();
  const listId = useId();

  function submit(event) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addAnotherPurchase(bottleId, { quantity: count, price, currency, location: place });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setCount("1");
      setPrice("");
      showUndo(`Added another purchase of ${name}`, () => undoAddedPurchase(result.id));
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 self-start rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      >
        Add another purchase of this wine
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Bought more at a different price, or keeping some somewhere else? It becomes its own line, with the same wine
        details.
      </p>
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
          <span id={`${listId}-price`}>Paid per bottle (optional)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-labelledby={`${listId}-price`}
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
        <label className="flex flex-col gap-1 text-sm">
          Where it is
          <input
            value={place}
            onChange={(event) => setPlace(event.target.value)}
            list={`${listId}-places`}
            maxLength={MAX_LOCATION}
            className={`${inputClass} w-40`}
            placeholder="Rack B, Fridge"
          />
          <datalist id={`${listId}-places`}>
            {locationOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add purchase
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          Cancel
        </button>
        {pending && <Spinner label="Adding…" />}
      </div>
    </form>
  );
}
