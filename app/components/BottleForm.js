"use client";

import { useActionState, useEffect, useState } from "react";
import { allVarietalNames } from "@/lib/varietal-match";
import { KNOWN_REGIONS, countryForRegion } from "@/lib/regions";
import { WINE_COLORS, normalizeWineColor } from "@/lib/wine-colors";
import Spinner from "@/app/components/Spinner";
import AutoTextarea from "@/app/components/AutoTextarea";
import StarRating from "@/app/components/StarRating";
import { BOTTLE_SIZES } from "@/lib/bottle-sizes";
import { CURRENCIES, DEFAULT_CURRENCY, MAX_LOCATION } from "@/lib/lot-fields";

const inputClass =
  "min-h-11 rounded border border-zinc-300 px-2 py-1 text-base dark:border-zinc-700 dark:bg-zinc-900";
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
  // Size, place and price: only the Wine details form and the cellar's Add
  // form show them. The scan cards leave them out (a batch has its own "Put
  // them in" place), and a form that does not show them must not save them -
  // the hidden lotFields marker below is what tells the server it may.
  showLotFields = false,
  // Places already on file, offered as suggestions so a place is spelled one
  // way; the server settles case against the same list.
  locationOptions = [],
  // Where a bottle lives only means something while it is in the cellar; on a
  // wishlist or History row the field is not shown and its value is carried
  // through unchanged.
  showLocation = true,
  children,
}) {
  const [state, formAction, pending] = useActionState(action, null);

  // Region and Country stay uncontrolled everywhere else in this form, but
  // need real state here so picking a known region can fill Country in and
  // a mismatch can be flagged (BACKLOG #17) - neither is possible from a
  // plain defaultValue, which never sees what's typed afterward.
  const [region, setRegion] = useState(defaultValues.region || "");
  const [country, setCountry] = useState(defaultValues.country || "");
  // "" or "1".."5", the shape StarRating works in; the server still reads the
  // same `rating` field it always did.
  const [rating, setRating] = useState(defaultValues.rating == null ? "" : String(defaultValues.rating));
  const impliedCountry = countryForRegion(region);
  // Soft, not blocking: a region genuinely can move countries over time
  // (a producer relocating, an appellation redrawn), and the curated list
  // is suggestions, not law - this says "you might mean X" rather than
  // refusing "Bordeaux" paired with "Spain".
  const countryMismatch =
    impliedCountry && country.trim() && country.trim().toLowerCase() !== impliedCountry.toLowerCase();

  function handleRegionChange(event) {
    const next = event.target.value;
    setRegion(next);
    // Only when Country is still blank - never overwrites a country
    // someone already chose, including one that disagrees with the region
    // (that's what the mismatch note below is for, not a silent rewrite).
    const implied = countryForRegion(next);
    if (implied && !country.trim()) setCountry(implied);
  }

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
      {showLotFields && <input type="hidden" name="lotFields" value="1" />}
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
      <datalist id={`${idPrefix}-location-options`}>
        {locationOptions.map((name) => (
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
                value={region}
                onChange={handleRegionChange}
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
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className={inputClass}
              />
              {countryMismatch && (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {region.trim()} is usually {impliedCountry} — this bottle
                  is set to {country.trim()}.
                </span>
              )}
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
                // Two decimals: a step of 0.1 rejects a real label value
                // like 13.75 as invalid rather than just rounding it.
                step="0.01"
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
              {/* Says what's already true (clearEstimatedFlagIfWindowChanged
                  in app/actions.js already clears the flag on a real edit)
                  rather than leaving it to be discovered - the "estimated"
                  label everywhere else in the app is only trustworthy if
                  it's clear how a bottle stops carrying it. */}
              {defaultValues.drinkWindowEstimated && (
                <p className="mt-1 text-xs text-zinc-500">
                  These years are an estimate — editing them marks them as
                  yours.
                </p>
              )}
            </div>
          </div>
        </div>
        {showLotFields && (
          <div className="flex flex-col gap-2">
            <p className={sectionLabelClass}>Size, place &amp; price</p>
            <div className="grid grid-cols-2 gap-3">
              <label className={labelClass}>
                Bottle size
                <select
                  name="sizeMl"
                  defaultValue={defaultValues.sizeMl ?? ""}
                  className={inputClass}
                >
                  <option value="">Not recorded</option>
                  {BOTTLE_SIZES.map((size) => (
                    <option key={size.ml} value={size.ml}>
                      {size.label}
                    </option>
                  ))}
                  {defaultValues.sizeMl &&
                    !BOTTLE_SIZES.some((size) => size.ml === defaultValues.sizeMl) && (
                      <option value={defaultValues.sizeMl}>{defaultValues.sizeMl} ml</option>
                    )}
                </select>
              </label>
              {showLocation ? (
                <label className={labelClass}>
                  Where it is
                  <input
                    name="location"
                    list={`${idPrefix}-location-options`}
                    maxLength={MAX_LOCATION}
                    defaultValue={defaultValues.location || ""}
                    className={inputClass}
                    placeholder="e.g. Rack B, Fridge"
                  />
                </label>
              ) : (
                <input type="hidden" name="location" value={defaultValues.location || ""} />
              )}
              <div className={`${labelClass} col-span-2`}>
                <span id={`${idPrefix}-price`}>Price paid, per bottle (optional)</span>
                <div className="flex items-center gap-2">
                  <input
                    name="price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    aria-labelledby={`${idPrefix}-price`}
                    defaultValue={
                      defaultValues.pricePaidCents == null
                        ? ""
                        : (defaultValues.pricePaidCents / 100).toFixed(2)
                    }
                    className={`${inputClass} w-28`}
                    placeholder="e.g. 24.50"
                  />
                  <select
                    name="currency"
                    aria-label="Currency"
                    defaultValue={defaultValues.priceCurrency || DEFAULT_CURRENCY}
                    className={inputClass}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Bought more at a different price? Add it as another
                  purchase rather than averaging.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Three kinds of writing about a wine, each named for what it is:
          this one, Source (where it came from, what it cost, who gave it
          to you); Critic & winemaker notes, which Research writes; and
          Tasting notes, dated and about one evening. It was "Your notes",
          then "Notes" in conversation, and a generic name kept reading as a
          duplicate of the other two. The column is still `notes`; only what
          it is called changed (BACKLOG #62). */}
      <label className={labelClass}>
        Source
        <span className="text-xs text-zinc-500">
          Where it came from, what it cost, who gave it to you.
        </span>
        <AutoTextarea
          name="notes"
          minRows={3}
          defaultValue={defaultValues.notes || ""}
          className={inputClass}
          placeholder="e.g. from Flatiron Wines; a gift from Dana; direct from the winery"
        />
      </label>
      <label className={labelClass}>
        Critic &amp; winemaker notes
        {/* The one field that routinely holds several paragraphs, so it
            starts taller and is allowed to grow further than the rest. */}
        <AutoTextarea
          name="criticNotes"
          minRows={6}
          maxHeight={480}
          defaultValue={defaultValues.criticNotes || ""}
          className={inputClass}
          placeholder="Filled in by Research — the winery's own notes, critic reviews, etc."
        />
      </label>
      {includeTastingNote && (
        <div className="flex flex-col gap-3 rounded border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="text-xs font-medium text-zinc-500">
            Tasting note (optional)
          </p>
          <label className={labelClass}>
            Note
            <AutoTextarea
              name="note"
              minRows={3}
              defaultValue={defaultValues.note || ""}
              className={inputClass}
            />
          </label>
          <div className={`${labelClass} max-w-[12rem]`}>
            <span id={`${idPrefix}-rating`}>Rating (opt.)</span>
            <StarRating value={rating} onChange={setRating} labelledBy={`${idPrefix}-rating`} />
          </div>
        </div>
      )}
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? <Spinner label="Saving…" /> : submitLabel}
      </button>
      {children}
    </form>
  );
}
