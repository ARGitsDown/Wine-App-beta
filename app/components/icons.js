// Small, consistent-style line icons for the homepage's cards - plain
// stroke-based shapes (no icon library) so the home screen reads as an
// app's dashboard rather than a bare list of links.

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
