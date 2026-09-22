import { maySignIn, normalizeEmail } from "../lib/invite-policy.js";
let pass = 0, fail = 0;
const t = (name, got, want) => {
  if (got === want) { pass++; }
  else { fail++; console.log(`  FAIL ${name}: got ${got}, want ${want}`); }
};

// The ordinary case
t("invited, cellar claimed", maySignIn({ email: "a@x.com", hasInvite: true, cellarUnclaimed: false }), true);
t("invited, cellar unclaimed", maySignIn({ email: "a@x.com", hasInvite: true, cellarUnclaimed: true }), true);

// The door that must stay shut
t("stranger, claimed cellar", maySignIn({ email: "s@x.com", hasInvite: false, cellarUnclaimed: false }), false);
t("stranger, claimed, OWNER_EMAIL set", maySignIn({ email: "s@x.com", hasInvite: false, cellarUnclaimed: false, ownerEmail: "me@x.com" }), false);
t("stranger vs OWNER_EMAIL, unclaimed", maySignIn({ email: "s@x.com", hasInvite: false, cellarUnclaimed: true, ownerEmail: "me@x.com" }), false);

// Bootstrap
t("bootstrap: unclaimed, no OWNER_EMAIL", maySignIn({ email: "me@x.com", hasInvite: false, cellarUnclaimed: true }), true);
t("owner claims with OWNER_EMAIL", maySignIn({ email: "me@x.com", hasInvite: false, cellarUnclaimed: true, ownerEmail: "me@x.com" }), true);

// The trap a real deploy fell into 2026-09-22: maySignIn is stateless, so
// it cannot by itself guarantee anyone gets back in. The owner's actual
// first sign-in matched the row above and claimed the cellar; their
// second looked exactly like this - same address, cellar no longer
// unclaimed, still no invite - and was correctly refused by this
// function. That refusal is not a bug in maySignIn; it is proof that
// isAllowedToSignIn (lib/auth.js) MUST write an accepted Invite row every
// time it lets a bootstrap pass through with no existing invite, or the
// owner is locked out of their own cellar after exactly one sign-in.
t(
  "second sign-in after the cellar is claimed, with no invite ever recorded, is refused",
  maySignIn({ email: "me@x.com", hasInvite: false, cellarUnclaimed: false, ownerEmail: "me@x.com" }),
  false
);
t(
  "...which is exactly why isAllowedToSignIn must persist one - same address, now with the invite it should have left behind",
  maySignIn({ email: "me@x.com", hasInvite: true, cellarUnclaimed: false, ownerEmail: "me@x.com" }),
  true
);

// Case and whitespace must not be a way in or a way out
t("case-insensitive owner match", maySignIn({ email: "Me@X.com", hasInvite: false, cellarUnclaimed: true, ownerEmail: "me@x.com" }), true);
t("whitespace trimmed", maySignIn({ email: "  me@x.com  ", hasInvite: false, cellarUnclaimed: true, ownerEmail: "me@x.com" }), true);

// Missing email is never a way in
for (const bad of [null, undefined, "", "   "]) {
  t(`no email (${JSON.stringify(bad)}) even when invited`, maySignIn({ email: bad, hasInvite: true, cellarUnclaimed: true }), false);
}
t("normalizeEmail", normalizeEmail("  A@B.COM "), "a@b.com");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
