// Several research runs at once: how the page adds them up and where each wine
// stands. Pure functions, so plain assertions.
import { summarizeRuns, researchStates, STALLED_AFTER_MS } from "../lib/research-job.js";

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log(`  FAIL ${name}: got ${g}, want ${w}`); }
};
const now = new Date().toISOString();
const old = new Date(Date.now() - STALLED_AFTER_MS - 60000).toISOString();
const run = (o) => ({ id: 1, total: 1, researched: 0, failed: 0, status: "running", updatedAt: now, pendingIds: [], ...o });

t("no runs, no summary", summarizeRuns([]), null);
t("one live run", summarizeRuns([run({ total: 3, researched: 1 })]), { total: 3, researched: 1, failed: 0, running: true, paused: false, stalled: false });
t("runs add up and one live run is enough to be running", summarizeRuns([run({ total: 2, researched: 2, status: "done" }), run({ id: 2, total: 1 })]), { total: 3, researched: 2, failed: 0, running: true, paused: false, stalled: false });
t("all done", summarizeRuns([run({ total: 2, researched: 1, failed: 1, status: "done" })]), { total: 2, researched: 1, failed: 1, running: false, paused: false, stalled: false });
t("a paused run with nothing live reads paused", summarizeRuns([run({ status: "paused" }), run({ id: 2, status: "done" })]).paused, true);
t("a quiet running run reads stopped, not running", summarizeRuns([run({ updatedAt: old })]), { total: 1, researched: 0, failed: 0, running: false, paused: false, stalled: true });
t("a live run beats a stalled one", summarizeRuns([run({ updatedAt: old }), run({ id: 2 })]).running, true);

const states = researchStates([
  run({ pendingIds: [5, 6, 7] }),
  run({ id: 2, pendingIds: [9] }),
  run({ id: 3, pendingIds: [11], updatedAt: old }),
  run({ id: 4, pendingIds: [12], status: "paused" }),
]);
t("the front of a run is being researched", states.get(5), "researching");
t("the rest of it is queued", [states.get(6), states.get(7)], ["queued", "queued"]);
t("each run has its own front", states.get(9), "researching");
t("a stalled run promises nothing", states.get(11), undefined);
t("a paused run promises nothing", states.get(12), undefined);
t("no runs, nothing queued", researchStates(null).size, 0);

console.log(`research-job: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
