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
