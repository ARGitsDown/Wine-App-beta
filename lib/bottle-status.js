// Where a wine is: the four stored words of Bottle.status. In the database
// (changing one is a migration, not a rename), and held there by the CHECK
// Bottle_status_known. Writers that take a status from a browser check it
// here first, so a bad value is refused with a message rather than by a
// database error.
export const BOTTLE_STATUS = Object.freeze({
  INVENTORY: "inventory",
  WISHLIST: "wishlist",
  CONSUMED: "consumed",
  FLIGHT: "flight",
});
export const BOTTLE_STATUS_VALUES = new Set(Object.values(BOTTLE_STATUS));

export function isBottleStatus(value) {
  return BOTTLE_STATUS_VALUES.has(value);
}
