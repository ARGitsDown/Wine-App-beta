"use client";

import { useEffect, useRef, useState } from "react";

// Long text cut to a few lines with a "Read more" that opens the rest - and
// no button at all when the text already fits, so a short note carries no
// control it doesn't need. Used for the critic and winemaker notes on a
// wine's page, which Research fills with a paragraph or more.
export default function ExpandableText({ text, lines = 4, className = "" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Measured while clamped: scrollHeight is the full text, clientHeight the
  // clamped box. Re-measured when the text changes.
  useEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);

  return (
    <div>
      <p
        ref={ref}
        className={`whitespace-pre-wrap ${className}`}
        style={
          open
            ? undefined
            : { display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }
        }
      >
        {text}
      </p>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 items-center text-sm text-sky-700 underline underline-offset-2 dark:text-sky-300"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
