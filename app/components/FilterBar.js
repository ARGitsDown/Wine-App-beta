import Link from "next/link";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-xs text-zinc-500";

export default function FilterBar({ basePath, filters }) {
  const hasAnyFilter = Boolean(
    filters.variety || filters.region || filters.vintage || filters.rating
  );

  return (
    <form
      action={basePath}
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <label className={labelClass}>
        Variety / type
        <input
          name="variety"
          defaultValue={filters.variety || ""}
          className={inputClass}
        />
      </label>
      <label className={labelClass}>
        Region
        <input
          name="region"
          defaultValue={filters.region || ""}
          className={inputClass}
        />
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
