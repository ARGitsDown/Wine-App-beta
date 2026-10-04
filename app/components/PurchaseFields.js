"use client";

import { useId } from "react";
import { CURRENCIES, MAX_LOCATION } from "@/lib/lot-fields";

const inputClass =
  "min-h-11 rounded border border-zinc-300 px-2 text-base dark:border-zinc-700 dark:bg-zinc-900";

// How many, what each cost, and where it is: the three things that differ
// between purchases of one wine. Shared by "Bought it" (a wishlist wine
// becoming a cellar wine) and "Add another purchase", so the two ask for the
// same things in the same way. The parent owns the state and the submit.
export default function PurchaseFields({
  count,
  onCount,
  price,
  onPrice,
  currency,
  onCurrency,
  place,
  onPlace,
  priceLabel = "Paid per bottle (optional)",
  locationOptions = [],
}) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        How many
        <input
          type="number"
          min="1"
          max="999"
          inputMode="numeric"
          value={count}
          onChange={(event) => onCount(event.target.value)}
          className={`${inputClass} w-20`}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <span id={`${id}-price`}>{priceLabel}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={price}
            onChange={(event) => onPrice(event.target.value)}
            aria-labelledby={`${id}-price`}
            className={`${inputClass} w-24`}
            placeholder="24.50"
          />
          <select
            value={currency}
            onChange={(event) => onCurrency(event.target.value)}
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
          onChange={(event) => onPlace(event.target.value)}
          list={`${id}-places`}
          maxLength={MAX_LOCATION}
          className={`${inputClass} w-40`}
          placeholder="Rack B, Fridge"
        />
        <datalist id={`${id}-places`}>
          {locationOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </label>
    </div>
  );
}
