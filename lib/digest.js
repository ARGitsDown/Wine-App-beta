// The cellar digest email: who is due one, and what it says. Pure, so the
// rules are tested (scripts/digest.test.mjs); sending is lib/email.js and the
// cron route is app/api/digest/route.js.
//
// Drinking windows are whole years (Bottle.drinkFrom / drinkTo), so nothing
// here can say "this month": it says what opens, closes or has passed *this
// year*. Cellar rows only, and never a price, a note or a place - an email is
// the one place this app's data leaves it.

import { windowBucket } from "./drink-window.js";
import { wineLabel } from "./bottle-trash.js";

export const DIGEST_FREQUENCIES = Object.freeze({
  weekly: { label: "Weekly", minDays: 6 },
  monthly: { label: "Monthly", minDays: 27 },
});

export function isDigestFrequency(value) {
  return Object.hasOwn(DIGEST_FREQUENCIES, value);
}

// A digest is due when the person has asked for one and enough days have
// passed since the last (a day short of the period, so a cron that drifts by
// hours never skips a whole cycle). Never sent: due at once.
export function isDigestDue({ digestFrequency, digestLastSentAt }, now = new Date()) {
  if (!isDigestFrequency(digestFrequency)) return false;
  if (!digestLastSentAt) return true;
  const days = (now.getTime() - new Date(digestLastSentAt).getTime()) / 86400000;
  return days >= DIGEST_FREQUENCIES[digestFrequency].minDays;
}

export function wineName(bottle) {
  const name = wineLabel(bottle);
  return (bottle.quantity ?? 1) > 1 ? `${name} (×${bottle.quantity})` : name;
}

const SHOWN = 8;

function section(title, bottles) {
  if (bottles.length === 0) return null;
  const names = bottles
    .slice()
    .sort((a, b) => (a.producer || "").localeCompare(b.producer || ""))
    .map(wineName);
  return { title, count: bottles.length, names: names.slice(0, SHOWN), more: Math.max(0, names.length - SHOWN) };
}

// null when there is nothing worth an email: a digest that only says "all is
// well" teaches people to ignore the one that matters.
export function buildDigest(bottles, { year = new Date().getFullYear(), appUrl = null } = {}) {
  const inCellar = bottles;
  const ready = inCellar.filter((b) => windowBucket(b, year) === "ready");
  const opening = inCellar.filter((b) => b.drinkFrom === year && windowBucket(b, year) === "ready");
  const closing = inCellar.filter((b) => b.drinkTo === year);
  const past = inCellar.filter((b) => windowBucket(b, year) === "past");
  const sections = [
    section(`Last year to drink (${year})`, closing),
    section(`Opening this year (${year})`, opening),
    section("Past peak", past),
  ].filter(Boolean);
  if (sections.length === 0) return null;

  const estimated = ready.filter((b) => b.drinkWindowEstimated).length;
  const headline =
    ready.length > 0
      ? `${ready.length} ready now${estimated > 0 ? ` (${estimated} on an estimated window)` : ""}.`
      : "Nothing is inside its window yet.";
  const parts = [
    closing.length > 0 ? `${closing.length} in their last year` : null,
    opening.length > 0 ? `${opening.length} opening` : null,
    past.length > 0 ? `${past.length} past peak` : null,
  ].filter(Boolean);
  const subject = `Your cellar: ${parts.join(", ")}`;
  const foot = "Drinking windows are whole years, so this is as of this year, not this week.";

  const text = [
    headline,
    "",
    ...sections.flatMap((s) => [
      `${s.title} - ${s.count}`,
      ...s.names.map((name) => `  ${name}`),
      ...(s.more > 0 ? [`  and ${s.more} more`] : []),
      "",
    ]),
    foot,
    appUrl ? `Open your cellar: ${appUrl}/inventory` : null,
    "To stop these, turn the digest off on the People page.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const esc = (value) =>
    String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:32rem">
<p><strong>${esc(headline)}</strong></p>
${sections
  .map(
    (s) =>
      `<h3 style="margin:1rem 0 .25rem">${esc(s.title)} <span style="font-weight:normal;color:#666">- ${s.count}</span></h3><ul style="margin:0;padding-left:1.1rem">${s.names
        .map((name) => `<li>${esc(name)}</li>`)
        .join("")}${s.more > 0 ? `<li>and ${s.more} more</li>` : ""}</ul>`
  )
  .join("\n")}
<p style="color:#666;font-size:.85rem">${esc(foot)}</p>
${appUrl ? `<p><a href="${esc(appUrl)}/inventory">Open your cellar</a></p>` : ""}
<p style="color:#666;font-size:.85rem">To stop these, turn the digest off on the People page.</p>
</div>`;

  return { subject, text, html };
}
