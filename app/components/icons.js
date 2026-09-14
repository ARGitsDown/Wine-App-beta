// Small, consistent-style line icons for the homepage's cards - plain
// stroke-based shapes (no icon library) so the home screen reads as an
// app's dashboard rather than a bare list of links.
//
// These are hand-written SVG paths in this file rather than image assets:
// nothing to host, nothing to license, no extra request per icon, and they
// inherit the surrounding text colour (stroke: currentColor) so they work
// in both themes without a second copy. Adding one means adding a function
// here in the same 24x24 / 1.5-stroke frame as the rest.

const commonProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function BottleIcon({ className = "h-6 w-6" }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <path d="M10 2h4v3.5l1.5 2V21a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V7.5l1.5-2z" />
      <path d="M10 2h4" />
      <path d="M9 13h6" />
    </svg>
  );
}

export function HeartIcon({ className = "h-6 w-6" }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <path d="M12 20s-7-4.35-9.5-8.5C.9 8.2 2.4 5 5.6 5c1.8 0 3.3 1 4.4 2.6C11.1 6 12.6 5 14.4 5c3.2 0 4.7 3.2 3.1 6.5C19 15.65 12 20 12 20z" />
    </svg>
  );
}

export function ClockIcon({ className = "h-6 w-6" }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function CameraIcon({ className = "h-6 w-6" }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .8-.4l1-1.3a1 1 0 0 1 .8-.4h3.4a1 1 0 0 1 .8.4l1 1.3a1 1 0 0 0 .8.4h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.8" r="3.2" />
    </svg>
  );
}

export function SparkleIcon({ className = "h-6 w-6" }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <path d="M10 3.5l1.7 4.3 4.3 1.7-4.3 1.7L10 15.5l-1.7-4.3L4 9.5l4.3-1.7z" />
      <path d="M17.5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

// Three glasses in a row - a flight is a sequence, so the icon shows one.
export function FlightIcon({ className = "h-6 w-6" }) {
  return (
    <svg {...commonProps} className={className} aria-hidden="true">
      <path d="M3 6h4l-.4 3.2a1.6 1.6 0 0 1-3.2 0z" />
      <path d="M5 9.8v5.2M3.6 15h2.8" />
      <path d="M10 6h4l-.4 3.2a1.6 1.6 0 0 1-3.2 0z" />
      <path d="M12 9.8v5.2M10.6 15h2.8" />
      <path d="M17 6h4l-.4 3.2a1.6 1.6 0 0 1-3.2 0z" />
      <path d="M19 9.8v5.2M17.6 15h2.8" />
    </svg>
  );
}
