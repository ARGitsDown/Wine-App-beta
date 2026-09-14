"use client";

import { useEffect, useRef } from "react";

// A textarea that opens at the size of its content instead of a fixed few
// rows. Research fills "Critic & winemaker notes" with a synthesis of the
// winery's own description plus several critics, which at three rows meant
// reading a paragraph through a letterbox.
//
// Grows to fit, then caps and scrolls, so a very long note can't push the
// rest of the form off the screen. Still drag-resizable: a manual drag
// wins until the next keystroke re-measures.
// Module scope so it's a stable reference, not a new closure each render
// that the effect below would have to list as a dependency.
function fit(el, maxHeight) {
  if (!el) return;
  // Collapse first, or scrollHeight only ever reports the current height
  // and the box can grow but never shrink back.
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
}

export default function AutoTextarea({
  minRows = 3,
  maxHeight = 360,
  className = "",
  defaultValue,
  ...props
}) {
  const ref = useRef(null);

  // Re-measures when the value arrives from outside as well as on mount -
  // the Research and Add-a-photo panels hand this a filled-in note.
  useEffect(() => {
    fit(ref.current, maxHeight);
  }, [defaultValue, maxHeight]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      defaultValue={defaultValue}
      onInput={(event) => fit(event.currentTarget, maxHeight)}
      style={{ maxHeight }}
      className={`resize-y overflow-auto ${className}`}
      {...props}
    />
  );
}
