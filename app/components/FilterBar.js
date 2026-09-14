import Link from "next/link";
import { allVarietalNames } from "@/lib/varietal-match";
import { KNOWN_REGIONS } from "@/lib/regions";
import { WINE_COLORS } from "@/lib/wine-colors";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-xs text-zinc-500";

const VARIETY_NAMES = allVarietalNames();

export default function FilterBar({ basePath, filters, regionOptions = KNOWN_REGIONS }) {
  const hasAnyFilter = Boolean(
    filters.variety ||
      filters.region ||
      filters.subRegion ||
      filters.country ||
      filters.wineColor ||
      filters.vintage ||
      filters.rating
  );

  return (
    <form
      action={basePath}
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <datalist id="filter-variety-options">
        {VARIETY_NAMES.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <datalist id="filter-region-options">
        {regionOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <label className={labelClass}>
        Variety
        <input
          name="variety"
          list="filter-variety-options"
          defaultValue={filters.variety || ""}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Region
        <input
          name="region"
          list="filter-region-options"
          defaultValue={filters.region || ""}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Sub-region
        <input
          name="subRegion"
          defaultValue={filters.subRegion || ""}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Country
        <input
          name="country"
          defaultValue={filters.country || ""}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Color
        <select
          name="wineColor"
          defaultValue={filters.wineColor || ""}
          className={inputClass}
        >
          <option value="">Any</option>
          {WINE_COLORS.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Vintage
        <input
          name="vintage"
          type="number"
          inputMode="numeric"
          defaultValue={filters.vintage || ""}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Min. rating
        <select
          name="rating"
          defaultValue={filters.rating || ""}
          className={inputClass}
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n}+
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        Filter
      </button>
      {hasAnyFilter && (
        <Link
          href={basePath}
          className="text-sm text-zinc-500 underline underline-offset-2"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
