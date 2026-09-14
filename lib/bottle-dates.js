import { todayAtNoonUtc } from "@/lib/tasting-date";

// Where a bottle's two lifecycle dates come from. Both are derived from the
// status a row is moving to rather than set independently, so no caller can
// forget one - and they live here rather than in app/actions.js because
// that file is "use server", where every export has to be an async Server
// Action. A plain module keeps these callable (and testable) as what they
// are: two small pure functions.

// emptiedAt only means something while a row is in History, so it's derived
// from the status change rather than set independently: stamped on the way
// in, cleared on the way out. Every path that moves a bottle between states
// goes through here so none of them can forget.
//
// An existing date is never overwritten - re-selecting "Tasted" on a scan
// card that's already there shouldn't silently reset when you drank it -
// but leaving and returning does re-stamp, because by then the old date is
// describing a different event.
export function emptiedAtForStatus(status, existingEmptiedAt) {
  if (status !== "consumed") return null;
  return existingEmptiedAt ?? todayAtNoonUtc();
}

// acquiredAt is the same idea from the other end, but deliberately not a
// mirror image, because owning a bottle and having drunk it aren't
// opposites - you can only drink what you once owned.
//
//   wishlist  - null. You don't own it, so any date it carried has stopped
//               being true (this is the "bought it, then changed my mind"
//               correction).
//   inventory - stamped on arrival, never overwritten. "Bought it" from the
//               wishlist is the real acquisition event; a bottle that came
//               back from History already has its original date and keeps
//               it.
//   consumed  - whatever it had. Drinking a wine doesn't unmake the day you
//               bought it, and "acquired 2019, emptied 2026" is the fact
//               this column exists for. A wine logged straight to tasting
//               notes had no date to carry, and gets none invented - it
//               never sat in the cellar (BACKLOG.md #10).
//
// The consumed case is "leave it alone", which is why the paths that only
// ever move a bottle into History (markOneTasted) don't call this at all.
export function acquiredAtForStatus(status, existingAcquiredAt) {
  if (status === "wishlist") return null;
  if (status === "inventory") return existingAcquiredAt ?? todayAtNoonUtc();
  return existingAcquiredAt ?? null;
}
