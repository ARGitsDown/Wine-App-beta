// The fixed vocabulary for Bottle.wineColor (BACKLOG.md #3) - distinct from
// `type`, which names the grape/style rather than the color. Shared between
// the bottle form's <select>, the scan feature's extraction schema, and the
// filter bar, so all three stay in sync from one place.
export const WINE_COLORS = ["Red", "White", "Rosé", "Orange", "Sparkling", "Dessert", "Fortified"];

// Matches case-insensitively against WINE_COLORS - the scan feature is told
// the exact spelling/casing to use, but isn't schema-constrained to it (see
// WINE_ENTRY_SCHEMA in app/actions.js), so a value like "red" would
// otherwise silently fail a strict-equality check and disappear with no
// indication it was ever detected. Null for anything that still doesn't
// match one of the fixed categories.
export function normalizeWineColor(value) {
  if (!value) return null;
  const match = WINE_COLORS.find((color) => color.toLowerCase() === String(value).toLowerCase());
  return match ?? null;
}

// A small color-dot swatch per category, so a bottle list is scannable by
// color at a glance without reading each row. Deliberately approximate
// (real wine color varies a lot within a category) - just enough visual
// distinction to group rows, not a literal color match.
export const WINE_COLOR_SWATCH = {
  Red: "bg-red-800",
  White: "bg-yellow-200",
  "Rosé": "bg-pink-300",
  Orange: "bg-orange-400",
  Sparkling: "bg-amber-300",
  Dessert: "bg-amber-600",
  Fortified: "bg-amber-900",
};
