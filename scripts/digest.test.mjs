// Who is due a digest, and what it says (and does not say).
import { isDigestDue, buildDigest, wineName, isDigestFrequency } from "../lib/digest.js";

let pass = 0, fail = 0;
function t(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`}`);
}

const now = new Date("2026-10-04T14:00:00Z");
const daysAgo = (n) => new Date(now.getTime() - n * 86400000);
t("off is never due", isDigestDue({ digestFrequency: null, digestLastSentAt: null }, now), false);
t("an unknown word is never due", isDigestDue({ digestFrequency: "daily", digestLastSentAt: null }, now), false);
t("never sent: due", isDigestDue({ digestFrequency: "monthly", digestLastSentAt: null }, now), true);
t("monthly 10 days after: not yet", isDigestDue({ digestFrequency: "monthly", digestLastSentAt: daysAgo(10) }, now), false);
t("monthly 27 days after: due (a day of slack)", isDigestDue({ digestFrequency: "monthly", digestLastSentAt: daysAgo(27) }, now), true);
t("weekly 3 days after: not yet", isDigestDue({ digestFrequency: "weekly", digestLastSentAt: daysAgo(3) }, now), false);
t("weekly 6 days after: due", isDigestDue({ digestFrequency: "weekly", digestLastSentAt: daysAgo(6) }, now), true);
t("frequency check", [isDigestFrequency("weekly"), isDigestFrequency("toString"), isDigestFrequency(null)], [true, false, false]);

const Y = 2026;
const b = (producer, from, to, extra = {}) => ({ producer, drinkFrom: from, drinkTo: to, quantity: 1, ...extra });
t("nothing to say: no email", buildDigest([b("A", 2020, 2035), b("B", null, null), b("C", 2030, 2040)], { year: Y }), null);
t("empty cellar: no email", buildDigest([], { year: Y }), null);

const d = buildDigest(
  [
    b("Closing One", 2018, 2026, { vintage: 2015, quantity: 2 }),
    b("Opening One", 2026, 2040, { drinkWindowEstimated: true }),
    b("Past One", 2000, 2020, { bottling: "Cuvee" }),
    b("Fine", 2020, 2035),
    { ...b("Priced", 2000, 2010), pricePaidCents: 99999, notes: "SECRET NOTE", location: "Rack X" },
  ],
  { year: Y, appUrl: "https://cellar.example" }
);
t("subject counts what matters", d.subject, "Your cellar: 1 in their last year, 1 opening, 2 past peak");
t("text names the wines with count and vintage", d.text.includes("Closing One 2015 (×2)") && d.text.includes("Past One “Cuvee”"), true);
t("text carries the headline with the estimated share", d.text.startsWith("3 ready now (1 on an estimated window)."), true);
t("never carries a price, a note or a place", /99999|999\.99|SECRET|Rack X/.test(d.text + d.html), false);
t("links to the cellar", d.text.includes("https://cellar.example/inventory"), true);
t("no link without a base url", buildDigest([b("P", 2000, 2010)], { year: Y }).text.includes("http"), false);
const many = buildDigest(Array.from({ length: 11 }, (_, i) => b(`P${String(i).padStart(2, "0")}`, 2000, 2010)), { year: Y });
t("long lists are cut with a count", many.text.includes("and 3 more"), true);
t("html escapes", buildDigest([b("<b>x</b> & co", 2000, 2010)], { year: Y }).html.includes("&lt;b&gt;x&lt;/b&gt; &amp; co"), true);
t("wineName", [wineName({ producer: "A", vintage: 2019, quantity: 1 }), wineName({ producer: "A" })], ["A 2019", "A"]);

console.log(`digest: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
