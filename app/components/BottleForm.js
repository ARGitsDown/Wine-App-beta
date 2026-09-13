const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-sm";

export default function BottleForm({
  action,
  defaultValues = {},
  submitLabel = "Add bottle",
  includeTastingNote = false,
  children,
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      {defaultValues.confident === false && (
        <input type="hidden" name="needsResearch" value="true" />
      )}
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
            defaultValue={defaultValues.variety || ""}
            className={inputClass}
            placeholder="e.g. Cabernet Sauvignon"
          />
        </label>
        <label className={labelClass}>
          Region
          <input
            name="region"
            defaultValue={defaultValues.region || ""}
            className={inputClass}
            placeholder="e.g. Bordeaux, or a US state"
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
          Quantity
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue={defaultValues.quantity ?? 1}
            className={inputClass}
          />
        </label>
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
      <button
        type="submit"
        className="self-start rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {submitLabel}
      </button>
      {children}
    </form>
  );
}
