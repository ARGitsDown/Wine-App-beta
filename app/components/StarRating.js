"use client";

// A 1-5 rating as five tappable stars, in place of a number box you had to
// type into. Submits through a hidden input named `name`, empty when unrated,
// so the server (parseOptionalRating) reads it exactly as it read the number
// field. Tapping the star that is already chosen clears the rating - the
// rating is optional, and a row of stars has no other way to say "none".
//
// Controlled: `value` is "" or "1".."5", `onChange` gets the new string. Each
// star is 44px tall to match the date field it sits beside.
export default function StarRating({ name = "rating", value, onChange, labelledBy }) {
  const chosen = value === "" ? 0 : Number(value);
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex h-11 items-center">
      <input type="hidden" name={name} value={value} />
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={chosen === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          onClick={(event) => {
            onChange(chosen === n ? "" : String(n));
            // A tap is a click, not an input event, so a page that watches
            // its forms for edits (the scan cards' "unsaved" tracking listens
            // for input/change on a wrapper) would never hear that a rating
            // was set. Say so, the way a typed-into field would.
            event.currentTarget.dispatchEvent(new Event("input", { bubbles: true }));
          }}
          className={`h-11 min-w-0 flex-1 text-left text-2xl leading-none ${
            n <= chosen ? "text-amber-500" : "text-zinc-400 dark:text-zinc-600"
          }`}
        >
          <span aria-hidden="true">{n <= chosen ? "★" : "☆"}</span>
        </button>
      ))}
    </div>
  );
}
