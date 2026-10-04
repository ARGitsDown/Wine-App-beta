"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addAnotherPurchase, undoAddedPurchase } from "@/app/actions";
import { useUndo } from "@/app/components/UndoToast";
import Spinner from "@/app/components/Spinner";
import PurchaseFields from "@/app/components/PurchaseFields";
import { DEFAULT_CURRENCY } from "@/lib/lot-fields";

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
      <PurchaseFields
        count={count}
        onCount={setCount}
        price={price}
        onPrice={setPrice}
        currency={currency}
        onCurrency={setCurrency}
        place={place}
        onPlace={setPlace}
        locationOptions={locationOptions}
      />
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
