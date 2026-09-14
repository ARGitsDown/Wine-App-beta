// When a bottle was drunk is a calendar date, not an instant - "the 14th"
// is the same fact whoever is reading it. But it's stored in a DateTime
// column, so the two have to be bridged carefully in one place.
//
// The trap: an <input type="date"> submits "2026-09-14" with no timezone,
// and `new Date("2026-09-14")` reads that as UTC midnight. Rendered
// anywhere west of Greenwich that's the 13th - the date silently moves a
// day every time it round-trips.
//
// Two defences, because either alone is fragile. Values are anchored at
// noon UTC, which keeps the calendar date intact for anything reading them
// locally between UTC-12 and UTC+11 (past that - Kiritimati at UTC+14 -
// noon still rolls into the next day, so the anchor is a cushion, not a
// guarantee). And everything in this file formats with an explicit UTC
// timezone, which *is* exact: the displayed date can't drift with wherever
// the code happens to run, which for a server component is the server.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseTastedDate(value) {
  const text = String(value ?? "").trim();
  if (!DATE_ONLY.test(text)) return null;

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  // Rejects real-looking nonsense like 2026-02-31, which Date would
  // silently roll forward into March.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

// Formats for both display and for prefilling a date input, using UTC parts
// to match how the values above are stored. Deterministic wherever it runs
// - a server component would otherwise format in the server's timezone,
// which on Vercel is UTC anyway but isn't something to rely on by accident.
export function toDateInputValue(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatTastedDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function todayInputValue() {
  return toDateInputValue(new Date());
}
