// The recycle-bin snapshot: what is kept, that dates survive the JSON round
// trip, and that the date-field lists cover every date a row carries.
import { snapshotOf, reviveSnapshot, wineLabel, isoStringFields, dateFieldsFor, trashCutoff, TRASH_DAYS } from "../lib/bottle-trash.js";

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`}`);
}

const d = (s) => new Date(s);
const bottle = {
  id: 7, producer: "Rochioli", bottling: "Three Corner", vintage: 2018, status: "inventory", quantity: 3,
  acquiredAt: d("2026-01-02T12:00:00Z"), emptiedAt: null, createdAt: d("2026-01-02T15:00:00Z"), updatedAt: d("2026-02-02T15:00:00Z"),
  domaineId: "dom1", ownerId: null,
  tastingNotes: [{ id: 1, bottleId: 7, note: "Lovely", rating: 5, tastedAt: d("2026-03-01T12:00:00Z") }],
  photos: [{ id: 2, bottleId: 7, url: "https://x/y.jpg", createdAt: d("2026-01-03T10:00:00Z") }],
  favorites: [{ id: 3, guestId: 1, bottleId: 7, createdAt: d("2026-01-04T10:00:00Z") }],
  flightPicks: [{ id: 4, flightId: 9, bottleId: 7, order: 1, reason: null, consumed: false, originFlightOnly: false }],
  researchProposal: { id: 5, bottleId: 7, proposed: { drinkFrom: 2024 }, summary: "s", sources: ["a"], createdAt: d("2026-01-05T10:00:00Z") },
  pairingPicks: [{ id: 11 }, { id: 12 }],
};
const snap = snapshotOf(bottle);
t("label", wineLabel(bottle), "Rochioli “Three Corner” 2018");
t("the bottle's own columns are kept, children are not inside them", Object.keys(snap.bottle).includes("tastingNotes"), false);
t("pairing picks are kept as ids only", snap.pairingPickIds, [11, 12]);
t("snapshot is plain JSON", JSON.parse(JSON.stringify(snap)), snap);
const back = reviveSnapshot(snap);
t("bottle dates come back as dates", [back.bottle.acquiredAt instanceof Date, back.bottle.createdAt.getTime() === bottle.createdAt.getTime(), back.bottle.emptiedAt], [true, true, null]);
t("note date, photo date, favorite date, proposal date", [
  back.tastingNotes[0].tastedAt.getTime() === bottle.tastingNotes[0].tastedAt.getTime(),
  back.photos[0].createdAt instanceof Date,
  back.favorites[0].createdAt instanceof Date,
  back.researchProposal.createdAt instanceof Date,
], [true, true, true, true]);
t("proposal json untouched", back.researchProposal.proposed, { drinkFrom: 2024 });
// Every date-looking column in a snapshot must be one revive knows about.
const unknown = [
  ["bottle", isoStringFields(snap.bottle).filter((f) => !dateFieldsFor("bottle").includes(f))],
  ["tastingNotes", isoStringFields(snap.tastingNotes[0]).filter((f) => !dateFieldsFor("tastingNotes").includes(f))],
  ["photos", isoStringFields(snap.photos[0]).filter((f) => !dateFieldsFor("photos").includes(f))],
  ["favorites", isoStringFields(snap.favorites[0]).filter((f) => !dateFieldsFor("favorites").includes(f))],
  ["researchProposal", isoStringFields(snap.researchProposal).filter((f) => !dateFieldsFor("researchProposal").includes(f))],
];
t("no date column is missing from the revive lists", unknown.filter(([, f]) => f.length), []);
t("a wine with nothing attached", snapshotOf({ id: 1, producer: "X" }), { bottle: { id: 1, producer: "X" }, tastingNotes: [], photos: [], favorites: [], flightPicks: [], researchProposal: null, pairingPickIds: [] });
t("cutoff is 30 days back", trashCutoff(d("2026-10-31T00:00:00Z")).toISOString(), "2026-10-01T00:00:00.000Z");
t("retention", TRASH_DAYS, 30);

console.log(`bottle-trash: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
