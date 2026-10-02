// The rules of the monthly allowance, separated from the database so they
// can be tested exhaustively (scripts/usage.test.mjs) - the same split
// lib/invite-policy.js makes for the sign-in door.

// Calendar months in UTC. The simplest rule that matches "a monthly
// ceiling", and the one that's easy to say to the one person who'll ever
// ask why a feature changed: "it resets on the 1st". A rolling 30 days is
// more precise and a good deal harder to explain.
export function monthStartUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextMonthStartUTC(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

const MICROS_PER_CENT = 10_000;

// Where a Domaine stands this month:
//   "ok"      - under its cap, or it has none
//   "lighter" - at or past the cap: AI features keep working, one model
//               tier down
//   "stopped" - at or past the hard stop: AI features pause until the 1st
// A limit of null means "no limit of this kind"; the two are independent,
// so a Domaine can have a hard stop and no cap (or the reverse). The hard
// stop wins when both are crossed.
export function usageState({ spentMicros, capCents, hardStopCents }) {
  const spent = Number.isFinite(spentMicros) && spentMicros > 0 ? spentMicros : 0;
  if (hardStopCents != null && spent >= hardStopCents * MICROS_PER_CENT) return "stopped";
  if (capCents != null && spent >= capCents * MICROS_PER_CENT) return "lighter";
  return "ok";
}

// What a new Domaine gets: the owner's starting numbers, before there's
// any real spend to base better ones on. Overridable from the environment
// so changing them is a setting rather than a deploy of new code:
//   USAGE_DEFAULT_CAP_CENTS      - the monthly cap (default 500 = $5)
//   USAGE_HARD_STOP_MULTIPLIER   - hard stop as a multiple of the cap
//                                  (default 3; must be at least 1)
// Anything unparseable falls back to the default rather than throwing -
// this runs inside account creation, which must never fail over a typo.
export const DEFAULT_CAP_CENTS = 500;
export const DEFAULT_HARD_STOP_MULTIPLIER = 3;

export function defaultLimits(env = {}) {
  const cap = Number(env.USAGE_DEFAULT_CAP_CENTS);
  const multiplier = Number(env.USAGE_HARD_STOP_MULTIPLIER);
  const capCents = Number.isInteger(cap) && cap > 0 ? cap : DEFAULT_CAP_CENTS;
  const times = Number.isFinite(multiplier) && multiplier >= 1 ? multiplier : DEFAULT_HARD_STOP_MULTIPLIER;
  return {
    monthlySpendCapCents: capCents,
    monthlyHardStopCents: Math.round(capCents * times),
  };
}

// Dollars for people: "$0.42", and "under a cent" rather than "$0.00" for
// the first call or two, which would read as though nothing had happened.
export function formatMicros(micros) {
  if (!Number.isFinite(micros) || micros <= 0) return "$0.00";
  if (micros < MICROS_PER_CENT) return "under $0.01";
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

export function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// "1 October" - when the allowance resets, as a person would say it. In
// UTC, to match the boundary itself.
export function formatResetDate(date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
}
