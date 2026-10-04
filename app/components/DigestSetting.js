"use client";

import { useState, useTransition } from "react";
import { setDigestFrequency } from "@/app/(owner)/invites/actions";

const OPTIONS = [
  { value: "", label: "Off" },
  { value: "monthly", label: "Monthly" },
];

// Your own choice, saved the moment you tap it: three radios in one group, the
// same shape as the Drink / Hold control, with the saved state said in words.
export default function DigestSetting({ initial }) {
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function choose(next) {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await setDigestFrequency(next);
      if (result?.error) {
        setValue(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Cellar digest email" className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const on = value === option.value;
          return (
            <button
              key={option.value || "off"}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => choose(option.value)}
              className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-60 ${
                on
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-300 hover:border-zinc-500 dark:border-zinc-700"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
