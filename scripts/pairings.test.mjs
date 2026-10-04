// The pairing helpers: grouping by dish, the decision counts, and what
// counts as not owned. Pure functions, so plain assertions.
import {
  PICK_DECISION,
  PICK_DECISION_VALUES,
  groupPicksByDish,
  decisionCounts,
  pickNotOwned,
  daysFromToday,
  planLabel,
  orderPairings,
  dishKey,
  cleanPairingReason,
  progressParts,
  MAX_REASON,
} from "../lib/pairings.js";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${name}: got ${g}, want ${w}`); }
};

t("stored words", [...PICK_DECISION_VALUES].sort(), ["drink", "hold"]);
t("the constants can't be reassigned", (() => { try { "use strict"; PICK_DECISION.DRINK = "x"; } catch {} return PICK_DECISION.DRINK; })(), "drink");

const picks = [
  { id: 1, dish: "Starter", decision: "drink" },
  { id: 2, dish: "Main", decision: null },
  { id: 3, dish: "Main", decision: "hold" },
  { id: 4, dish: "Starter ", decision: null },
  { id: 5, dish: null, decision: null },
];
const groups = groupPicksByDish(picks);
t("groups in first-seen order", groups.map((g) => g.dish), ["Starter", "Main", null]);
t("a dish that returns joins its earlier group (trimmed)", groups[0].picks.map((p) => p.id), [1, 4]);
t("order kept inside a group", groups[1].picks.map((p) => p.id), [2, 3]);
t("a single-dish pairing is one group with no heading", groupPicksByDish([{ id: 1, dish: null }, { id: 2, dish: "" }]).map((g) => [g.dish, g.picks.length]), [[null, 2]]);
t("no picks, no groups", groupPicksByDish([]), []);

t("counts", decisionCounts(picks), { done: 0, drink: 1, hold: 1, undecided: 3 });
t("unknown stored value counts as undecided", decisionCounts([{ decision: "x" }]), { done: 0, drink: 0, hold: 0, undecided: 1 });
t("a drunk pick is done, not still to drink", decisionCounts([{ decision: "drink", drankAt: "2026-10-04T12:00:00Z" }, { decision: "drink" }]), { done: 1, drink: 1, hold: 0, undecided: 0 });

t("owned wine is not 'not owned'", pickNotOwned({ gap: null, bottle: { status: "inventory" } }), false);
t("a gap with no bottle is not owned", pickNotOwned({ gap: { producer: "p" }, bottle: null }), true);
t("a gap that became a wishlist bottle is still not owned", pickNotOwned({ gap: { producer: "p" }, bottle: { status: "wishlist" } }), true);
t("a gap that is now in the cellar is owned", pickNotOwned({ gap: { producer: "p" }, bottle: { status: "inventory" } }), false);
t("a bottle you no longer have is not a gap", pickNotOwned({ gap: null, bottle: null }), false);

// --- the plan: a day, compared against the reader's own today
t("same day", daysFromToday("2026-10-04", "2026-10-04"), 0);
t("tomorrow", daysFromToday("2026-10-05", "2026-10-04"), 1);
t("across a month end", daysFromToday("2026-11-01", "2026-10-31"), 1);
t("across a year end", daysFromToday("2027-01-01", "2026-12-31"), 1);
t("a passed day is negative", daysFromToday("2026-10-01", "2026-10-04"), -3);
t("not a day", daysFromToday("soon", "2026-10-04"), null);
t("no plan, no label", planLabel(null, "2026-10-04"), null);
t("today is Tonight", planLabel("2026-10-04", "2026-10-04"), { kind: "tonight", text: "Tonight" });
t("tomorrow", planLabel("2026-10-05", "2026-10-04"), { kind: "upcoming", text: "Tomorrow" });
t("later this week is a weekday", planLabel("2026-10-10", "2026-10-04"), { kind: "upcoming", text: "Saturday" });
t("a week or more away is a date", planLabel("2026-10-11", "2026-10-04"), { kind: "upcoming", text: "Oct 11" });
t("a passed day is Queued with its date, never Overdue", planLabel("2026-09-13", "2026-10-04"), { kind: "queued", text: "Queued \u00b7 Sep 13" });
t("yesterday is Queued", planLabel("2026-10-03", "2026-10-04"), { kind: "queued", text: "Queued \u00b7 Oct 3" });
// The same stored day reads right for readers on either side of UTC:
// an evening in New York is already the next UTC day.
t("evening in the Americas, UTC already tomorrow: still Tonight", planLabel("2026-10-04", "2026-10-04"), { kind: "tonight", text: "Tonight" });

const at = (id, plannedFor, createdAt) => ({ id, plannedFor, createdAt });
const ordered = orderPairings(
  [
    at("unplanned-old", null, "2026-09-01T00:00:00Z"),
    at("queued-old", "2026-09-13T12:00:00Z", "2026-09-01T00:00:00Z"),
    at("later", "2026-10-09T12:00:00Z", "2026-09-30T00:00:00Z"),
    at("unplanned-new", null, "2026-10-03T00:00:00Z"),
    at("tonight", "2026-10-04T12:00:00Z", "2026-09-20T00:00:00Z"),
    at("queued-recent", "2026-10-01T12:00:00Z", "2026-09-02T00:00:00Z"),
    at("tomorrow", "2026-10-05T12:00:00Z", "2026-09-25T00:00:00Z"),
  ],
  "2026-10-04"
);
t("order: soonest planned, then queued (latest first), then unplanned (newest first)", ordered.map((p) => p.id), ["tonight", "tomorrow", "later", "queued-recent", "queued-old", "unplanned-new", "unplanned-old"]);
t("a plan for the UTC day before (the reader's today in the Americas) is not queued", orderPairings([at("a", null, "2026-10-01T00:00:00Z"), at("b", "2026-10-03T12:00:00Z", "2026-10-01T00:00:00Z")], "2026-10-04").map((p) => p.id), ["b", "a"]);

// --- the dish key and grouping by it
t("same course, different dressing", [dishKey("The lamb"), dishKey("the lamb."), dishKey("  Lamb  ")], ["lamb", "lamb", "lamb"]);
t("punctuation and case are ignored", dishKey("Main: Slow-Roasted Lamb"), "main slow roasted lamb");
t("different courses stay different", dishKey("Lamb") === dishKey("Lamb tagine"), false);
t("accented letters survive", dishKey("Crème brûlée"), "crème brûlée");
t("no dish", [dishKey(null), dishKey(""), dishKey("  ")], [null, null, null]);
const drift = groupPicksByDish([
  { id: 1, dish: "The lamb" },
  { id: 2, dish: "Starter" },
  { id: 3, dish: "the lamb." },
  { id: 4, dish: " Lamb " },
]);
t("drifted spellings of one dish share a group", drift.map((g) => g.picks.map((p) => p.id)), [[1, 3, 4], [2]]);
t("the heading is the first spelling seen", drift.map((g) => g.dish), ["The lamb", "Starter"]);

// --- the reason, as stored
t("markdown marks are stripped", cleanPairingReason("**Bright** acidity, _lifted_ by `lemon`."), "Bright acidity, lifted by lemon.");
t("line breaks and runs of spaces collapse", cleanPairingReason("One.\n\n- two\n  three"), "One. - two three");
t("a short reason is untouched", cleanPairingReason("Dry rosé keeps the peach fresh."), "Dry rosé keeps the peach fresh.");
const longText = "A good sentence here. ".repeat(80);
const cut = cleanPairingReason(longText);
t("a long reason is cut at a sentence end inside the limit", [cut.length <= MAX_REASON, cut.endsWith(".")], [true, true]);
const noStops = cleanPairingReason("word ".repeat(400));
t("with no sentence end it cuts at a word with an ellipsis", [noStops.length <= MAX_REASON + 1, noStops.endsWith("\u2026")], [true, true]);
t("nothing in, nothing out", cleanPairingReason(null), "");

// --- the progress line
const C = (drink, hold, undecided, done = 0) => ({ done, drink, hold, undecided });
t("planned and decided: to drink", progressParts(C(2, 1, 1), true).map((p) => p.text), ["2 to drink", "1 on hold", "1 undecided"]);
t("not planned and decided: chosen (no 'to drink' once the day is cleared)", progressParts(C(2, 1, 1), false).map((p) => p.text), ["2 chosen", "1 on hold", "1 undecided"]);
t("zero counts are left out", progressParts(C(0, 0, 3), false).map((p) => p.text), ["3 undecided"]);
t("planned with nothing chosen says so", progressParts(C(0, 0, 3), true).map((p) => p.text), ["Nothing chosen yet"]);
t("only the Drink count is strong", progressParts(C(1, 1, 1), true).map((p) => p.strong), [true, false, false]);
t("only holds", progressParts(C(0, 2, 0), false).map((p) => p.text), ["2 on hold"]);

t("tasted leads, then to drink", progressParts(C(1, 1, 1, 2), true).map((p) => p.text), ["2 tasted", "1 to drink", "1 on hold", "1 undecided"]);
t("only the tasted count is strong once there is one", progressParts(C(1, 0, 0, 2), true).map((p) => p.strong), [true, false]);
t("everything tasted", progressParts(C(0, 0, 0, 3), false).map((p) => p.text), ["3 tasted"]);

console.log(`pairings: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
