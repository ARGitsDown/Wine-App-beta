"use client";

import { useActionState, useEffect } from "react";
import { allVarietalNames } from "@/lib/varietal-match";
import { KNOWN_REGIONS } from "@/lib/regions";
import { WINE_COLORS, normalizeWineColor } from "@/lib/wine-colors";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-sm";
// A small uppercase heading above each field cluster below - purely visual
// grouping (Identity / Classification / Details) so the form reads as
// sections to scan rather than one flat wall of 14 equally-weighted
// inputs. Nothing moves or hides based on this; every field is still
// always present and always visible.
const sectionLabelClass =
  "text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500";

// Static, so computed once at module load rather than per render.
const VARIETY_NAMES = allVarietalNames();

export default function BottleForm({
  action,
  defaultValues = {},
  submitLabel = "Add bottle",
  includeTastingNote = false,
  // A page that already queries the DB (inventory, wishlist, the bottle
  // detail page) can pass a richer list via getRegionOptions() - anything
  // already saved, not just the curated defaults. Falls back to the
  // curated list alone for the client-rendered pages (scan, suggest) that
  // can't run that query themselves.
  regionOptions = KNOWN_REGIONS,
  // Only needs to change when several BottleForms render on the same page
  // at once (the scan flow, one per extracted wine) - keeps each
  // instance's <datalist> id unique so browsers don't get confused about
  // which list an input's suggestions should come from.
  idPrefix = "bottle-form",
  // Called with the action's returned state ({ success: true } or { error })
  // after every submission - lets a caller react to a save that actually
  // happened, rather than inferring it from the form merely going idle
  // again (which also happens on a silently swallowed failure).
  onResult,
  children,
}) {
  const [state, formAction, pending] = useActionState(action, null);

  useEffect(() => {
    if (state) onResult?.(state);
    // Only re-run when a new result comes in - onResult is typically a
    // fresh closure every render and isn't meant to retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const varietyListId = `${idPrefix}-variety-options`;
  const regionListId = `${idPrefix}-region-options`;

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {defaultValues.confident === false && (
        <input type="hidden" name="needsResearch" value="true" />
      )}
      {defaultValues.photoUrl && (
        <input type="hidden" name="photoUrl" value={defaultValues.photoUrl} />
      )}
      <datalist id={varietyListId}>
        {VARIETY_NAMES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id={regionListId}>
        {regionOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className={sectionLabelClass}>Identity</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Producer
              <input
                name="producer"
                required
                defaultValue={defaultValues.producer || ""}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Bottling / vineyard
              <input
                name="bottling"
                defaultValue={defaultValues.bottling || ""}
                className={inputClass}
                placeholder="e.g. Rochioli Vineyard, or a proprietary name"
              />
            </label>
            <label className={labelClass}>
              Vintage
              <input
                name="vintage"
                type="number"
                inputMode="numeric"
                defaultValue={defaultValues.vintage ?? ""}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className={sectionLabelClass}>Classification</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              Type (short, shown in lists)
              <input
                name="type"
                defaultValue={defaultValues.type || ""}
                className={inputClass}
                placeholder="e.g. Red Bordeaux Blend"
              />
            </label>
            <label className={labelClass}>
              Variety (fuller detail)
              <input
                name="variety"
                list={varietyListId}
                defaultValue={defaultValues.variety || ""}
                className={inputClass}
                placeholder="e.g. Cabernet Sauvignon"
              />
            </label>
            <label className={labelClass}>
              Region
              <input
                name="region"
                list={regionListId}
                defaultValue={defaultValues.region || ""}
                className={inputClass}
                placeholder="e.g. Bordeaux, or a US state"
              />
            </label>
            <label className={labelClass}>
              Sub-region
              <input
                name="subRegion"
                defaultValue={defaultValues.subRegion || ""}
                className={inputClass}
                placeholder="e.g. Margaux, or an AVA"
              />
            </label>
            <label className={labelClass}>
              Country
              <input
                name="country"
                defaultValue={defaultValues.country || ""}
                className={inputClass}
              />
            </label>
            <label className={labelClass}>
              Color
              <select
                name="wineColor"
                defaultValue={normalizeWineColor(defaultValues.wineColor) || ""}
                className={inputClass}
              >
                <option value="">Not set</option>
                {WINE_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className={sectionLabelClass}>Details</p>
          <div className="grid grid-cols-2 gap-3">
            <label className={labelClass}>
              ABV %
              <input
                name="abv"
                type="number"
                step="0.1"
                min="0"
                max="100"
                defaultValue={defaultValues.abv ?? ""}
                className={inputClass}
                placeholder="e.g. 14.5"
              />
            </label>
            <label className={labelClass}>
              Quantity
              <input
                name="quantity"
                type="number"
                min="1"
                defaultValue={defaultValues.quantity ?? 1}
                className={inputClass}
              />
            </label>
            <div className={`${labelClass} col-span-2`}>
              Drinking window (years, optional)
              <div className="flex items-center gap-2">
                <input
                  name="drinkFrom"
                  type="number"
                  inputMode="numeric"
                  defaultValue={defaultValues.drinkFrom ?? ""}
                  className={`${inputClass} w-24`}
                  placeholder="From"
                />
                <span className="text-zinc-400">–</span>
                <input
                  name="drinkTo"
                  type="number"
                  inputMode="numeric"
                  defaultValue={defaultValues.drinkTo ?? ""}
                  className={`${inputClass} w-24`}
                  placeholder="To"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <label className={labelClass}>
        Notes
        <textarea
          name="notes"
          rows={2}
          defaultValue={defaultValues.notes || ""}
          className={inputClass}
        />
      </label>
      {includeTastingNote && (
        <div className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500">
            Tasting note (optional)
          </p>
          <label className={labelClass}>
            Note
            <textarea
              name="note"
              rows={2}
              defaultValue={defaultValues.note || ""}
              className={inputClass}
            />
          </label>
          <label className={`${labelClass} max-w-[8rem]`}>
            Rating (1–5)
            <input
              name="rating"
              type="number"
              min="1"
              max="5"
              defaultValue={defaultValues.rating ?? ""}
              className={inputClass}
            />
          </label>
        </div>
      )}
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
      {children}
    </form>
  );
}
