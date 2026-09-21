#!/usr/bin/env node
// Loads every page of the app in a real browser and fails if any of them
// is broken. Meant to run against `next build` + `next start`, never
// against `next dev`.
//
// That distinction is the whole reason this file exists. On 2026-09-21 the
// entire Suggest page shipped broken: a client component imported a module
// that imported the Anthropic SDK, which throws on construction in a
// browser. `next build` succeeded - the import is legal - and `next dev`
// served the page perfectly, because dev assembles the module graph
// differently. Every check that had been run was a dev check, so nothing
// caught it until someone opened the deployed app.
//
// `import "server-only"` in lib/anthropic.js and lib/prisma.js now makes
// that *particular* mistake a failed build, which is a better guard than
// any test. This is the net for the next one that builds cleanly and
// breaks at runtime anyway - a hydration mismatch, a client-side throw, a
// page that 500s on an empty database.
//
// Deliberately shallow: it opens pages and checks nothing exploded. It is
// not a test suite and should not grow into one. The bar is "would a
// person opening this page see the app, or see the error boundary".

import { chromium } from "playwright";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3222";

// Whether the server under test has accounts switched on. When it does, an
// anonymous visitor reaching an owner page is *supposed* to be bounced to
// /signin, so "the page rendered" stops being the pass condition and
// "the door held" takes its place.
//
// Without this the check would go red the day authentication is enabled -
// not because anything broke, but because the test still expected an open
// app. A permanently red check is a dead check, so it learns the new rule
// rather than being switched off.
const AUTH_ON = process.env.SMOKE_AUTH_CONFIGURED === "true";

// Every route a signed-out-of-nothing owner can reach. /export streams a
// file rather than rendering, so navigation "fails" by design - it is
// checked for a non-error status only.
const PAGES = [
  { path: "/", owner: true },
  { path: "/suggest", owner: true },
  { path: "/pairings", owner: true },
  { path: "/flights", owner: true },
  { path: "/scan", owner: true },
  { path: "/inventory", owner: true },
  { path: "/wishlist", owner: true },
  { path: "/consumed", owner: true },
  { path: "/research", owner: true },
  { path: "/estimate-windows", owner: true },
  { path: "/invites", owner: true },
  // Public by design and it must stay that way: a guest browsing someone
  // else's cellar never signs in, and the sign-in page cannot sit behind
  // the thing it exists to get you through.
  { path: "/guest" },
  { path: "/signin" },
  { path: "/signin/check-email" },
  // A route handler, so it is NOT covered by the guard in the owner
  // layout - layouts do not wrap route handlers. It carries its own check,
  // and this asserts it, because the version without one returned the
  // entire cellar to anyone who asked.
  { path: "/export", download: true, owner: true, expectStatusWhenLockedOut: 401 },
];

// What the app itself shows when a page has thrown. Matching the copy
// rather than a class name because the copy is what a person sees, and if
// it ever changes this should be updated alongside it.
const BROKEN = /That didn't work|Application error|Unhandled Runtime Error/i;

const results = [];
const browser = await chromium.launch();

for (const { path, download, owner, expectStatusWhenLockedOut } of PAGES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message.split("\n")[0].slice(0, 160)));

  let status = null;
  try {
    const response = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    status = response?.status() ?? null;
  } catch (err) {
    // A download aborts navigation, which is success for /export and a
    // failure for anything else.
    if (!download) errors.push(`navigation failed: ${err.message.split("\n")[0].slice(0, 120)}`);
  }
  // Long enough for hydration to run and throw if it is going to.
  await page.waitForTimeout(1200);

  const body = await page.locator("body").innerText().catch(() => "");
  const boundary = BROKEN.test(body);
  const serverError = status !== null && status >= 500;

  // With accounts on, an owner route must refuse an anonymous visitor -
  // by bouncing them to /signin, or by answering 401 where a redirect
  // makes no sense (a download). Reaching the page itself is the failure.
  let doorFailure = null;
  if (AUTH_ON && owner) {
    if (expectStatusWhenLockedOut) {
      if (status !== expectStatusWhenLockedOut) {
        doorFailure = `expected ${expectStatusWhenLockedOut} while signed out, got ${status}`;
      }
    } else if (!page.url().includes("/signin")) {
      doorFailure = `reachable while signed out (landed on ${page.url()})`;
    }
  }

  results.push({ path, status, boundary, serverError, errors, doorFailure });
  await page.close();
}

await browser.close();

let failed = 0;
for (const r of results) {
  const bad = r.boundary || r.serverError || r.errors.length > 0 || r.doorFailure;
  if (bad) failed += 1;
  const marks = [
    r.serverError ? `HTTP ${r.status}` : null,
    r.boundary ? "error boundary" : null,
    r.doorFailure,
    ...r.errors,
  ].filter(Boolean);
  console.log(`${bad ? "FAIL" : "ok  "}  ${r.path.padEnd(20)}${marks.length ? "  :: " + marks.join(" :: ") : ""}`);
}

console.log(
  failed === 0
    ? `\nAll ${results.length} pages clean${AUTH_ON ? " (accounts on: owner routes refused an anonymous visitor)" : ""}.`
    : `\n${failed} of ${results.length} pages failing.`
);
process.exit(failed === 0 ? 0 : 1);
