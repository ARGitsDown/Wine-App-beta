// Turning a wine and everything attached to it into a JSON snapshot for the
// recycle bin (BottleTrash), and back into rows. Pure, so the shape is tested
// (scripts/bottle-trash.test.mjs); the transactions that use it are in
// app/actions.js (deleteBottle, restoreBottle).

export const TRASH_DAYS = 30;

// Columns that are dates, per kind of row. JSON turns every Date into an ISO
// string and cannot say which strings were dates, so the list is explicit and
// has to grow with a new date column (the test below fails if a row it is
// given carries a date-looking string the list does not know).
const DATE_FIELDS = {
  bottle: ["acquiredAt", "emptiedAt", "createdAt", "updatedAt"],
  tastingNotes: ["tastedAt"],
  photos: ["createdAt"],
  favorites: ["createdAt"],
  researchProposal: ["createdAt"],
};

// "Cellar" for what a restore will put it back on ("inventory"); null when the
// entry predates the column.
const LIST_NAMES = { inventory: "Cellar", wishlist: "Wishlist", consumed: "Tasting notes", flight: "Flights" };
export function listName(listedIn) {
  return LIST_NAMES[listedIn] ?? null;
}

export function wineLabel(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
}

// `bottle` is a Bottle row read with tastingNotes, photos, favorites,
// flightPicks, researchProposal and pairingPicks (ids only) included.
export function snapshotOf(bottle) {
  const { tastingNotes, photos, favorites, flightPicks, researchProposal, pairingPicks, ...columns } = bottle;
  return JSON.parse(
    JSON.stringify({
      bottle: columns,
      tastingNotes: tastingNotes ?? [],
      photos: photos ?? [],
      favorites: favorites ?? [],
      flightPicks: flightPicks ?? [],
      researchProposal: researchProposal ?? null,
      pairingPickIds: (pairingPicks ?? []).map((pick) => pick.id),
    })
  );
}

function revive(row, fields) {
  if (!row) return row;
  const out = { ...row };
  for (const field of fields) {
    if (typeof out[field] === "string") out[field] = new Date(out[field]);
  }
  return out;
}

// The snapshot with its dates as dates again, ready to hand to Prisma.
export function reviveSnapshot(snapshot) {
  return {
    bottle: revive(snapshot.bottle, DATE_FIELDS.bottle),
    tastingNotes: snapshot.tastingNotes.map((row) => revive(row, DATE_FIELDS.tastingNotes)),
    photos: snapshot.photos.map((row) => revive(row, DATE_FIELDS.photos)),
    favorites: snapshot.favorites.map((row) => revive(row, DATE_FIELDS.favorites)),
    flightPicks: snapshot.flightPicks,
    researchProposal: revive(snapshot.researchProposal, DATE_FIELDS.researchProposal),
    pairingPickIds: snapshot.pairingPickIds,
  };
}

// True for anything that looks like an ISO timestamp, so the test can prove
// DATE_FIELDS covers every date column in a snapshot.
export function isoStringFields(row) {
  return Object.entries(row ?? {})
    .filter(([, value]) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value))
    .map(([key]) => key);
}

export function dateFieldsFor(kind) {
  return DATE_FIELDS[kind];
}

export function trashCutoff(now = new Date()) {
  return new Date(now.getTime() - TRASH_DAYS * 86400000);
}

// Whole days left before a bin entry is due to be purged (a minimum: the purge
// only runs when the next delete does). Reads the clock itself so callers stay
// pure.
export function daysLeftInBin(deletedAt, now = Date.now()) {
  const elapsed = Math.floor((now - new Date(deletedAt).getTime()) / 86400000);
  return Math.max(0, TRASH_DAYS - elapsed);
}
