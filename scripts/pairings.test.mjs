// The pairing helpers: grouping by dish, the decision counts, and what
// counts as not owned. Pure functions, so plain assertions.
import {
  PICK_DECISION,
  PICK_DECISION_VALUES,
  groupPicksByDish,
  decisionCounts,
  pickNotOwned,
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

t("counts", decisionCounts(picks), { drink: 1, hold: 1, undecided: 3 });
t("unknown stored value counts as undecided", decisionCounts([{ decision: "x" }]), { drink: 0, hold: 0, undecided: 1 });

t("owned wine is not 'not owned'", pickNotOwned({ gap: null, bottle: { status: "inventory" } }), false);
t("a gap with no bottle is not owned", pickNotOwned({ gap: { producer: "p" }, bottle: null }), true);
t("a gap that became a wishlist bottle is still not owned", pickNotOwned({ gap: { producer: "p" }, bottle: { status: "wishlist" } }), true);
t("a gap that is now in the cellar is owned", pickNotOwned({ gap: { producer: "p" }, bottle: { status: "inventory" } }), false);
t("a bottle you no longer have is not a gap", pickNotOwned({ gap: null, bottle: null }), false);

console.log(`pairings: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
