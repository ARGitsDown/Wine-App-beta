import { STATUS_LOOK } from "@/lib/status-look";

// A small pill for a bottle's status, colored and iconed the same way the
// home cards and Scan's destination picker already are (see
// lib/status-look.js). No "use client" - it's plain markup, so both a
// Server Component (the bottle page) and a client one (Research's lists)
// can render it directly.
export default function StatusBadge({ status, className = "" }) {
  const look = STATUS_LOOK[status];
  // A status not in the curated set (there isn't one today, but a plain
  // string column doesn't guarantee that stays true) falls back to the
  // bare text this replaces, rather than rendering nothing.
  if (!look) {
    return (
      <span className={`text-xs capitalize text-zinc-500 ${className}`}>
        {status}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${look.accent} ${className}`}
    >
      <look.Icon className="h-3 w-3" />
      {look.label}
    </span>
  );
}
