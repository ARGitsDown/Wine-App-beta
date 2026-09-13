const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const labelClass = "flex flex-col gap-1 text-sm";

export default function BottleForm({
  action,
  defaultValues = {},
  submitLabel = "Add bottle",
  children,
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
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
