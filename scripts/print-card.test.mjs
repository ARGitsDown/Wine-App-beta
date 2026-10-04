// Which wines a printed card carries.
import { pairingCard, flightCard, pickWineText } from "../lib/print-card.js";

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`}`);
}
const pick = (dish, wineLabel, decision = null) => ({ dish, wineLabel, wineName: wineLabel, decision });

const chosen = pairingCard({
  title: "Sunday lamb", request: "Roast lamb and a cheese course",
  picks: [pick("Lamb", "Wine A 2015", "drink"), pick("Lamb", "Wine B 2016"), pick("Cheese", "Wine C", "hold"), pick("Cheese", "Wine D", "drink")],
});
t("chosen wines only, by dish", chosen.groups, [{ dish: "Lamb", wines: ["Wine A 2015"] }, { dish: "Cheese", wines: ["Wine D"] }]);
t("not marked as suggestions", chosen.suggestionsOnly, false);
t("request shown when it differs from the title", chosen.request, "Roast lamb and a cheese course");

const none = pairingCard({ title: "T", request: "T", picks: [pick(null, "Wine A"), pick(null, "Wine B", "hold"), pick(null, "Wine C")] });
t("nothing chosen: everything not on Hold, as suggestions", [none.groups, none.suggestionsOnly], [[{ dish: null, wines: ["Wine A", "Wine C"] }], true]);
t("request hidden when it is the title", none.request, null);
t("all on hold prints an empty card", pairingCard({ title: "T", picks: [pick(null, "X", "hold")] }).groups, []);
t("a pick with no label is skipped", pairingCard({ title: "T", picks: [pick(null, "  "), pick(null, "Real")] }).groups, [{ dish: null, wines: ["Real"] }]);
t("wine text falls back to the name", pickWineText({ wineLabel: "", wineName: "Name" }), "Name");
t("title falls back to the request", pairingCard({ request: "Fish", picks: [] }).title, "Fish");

const f = flightCard(
  { title: "Loire Whites", summary: "Chenin and Sauvignon", picks: [{ order: 2, bottle: { n: "B" }, reason: "why" }, { order: 1, bottle: { n: "A" }, reason: null }] },
  (b) => b.n
);
t("flight in running order, reasons left off", f.wines, [{ text: "A" }, { text: "B" }]);
t("flight title and summary", [f.title, f.summary], ["Loire Whites", "Chenin and Sauvignon"]);

console.log(`print-card: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
