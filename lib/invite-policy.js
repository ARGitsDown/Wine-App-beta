// Who may sign in, as a pure function.
//
// Separated from the database lookups in lib/auth.js on purpose: this is
// the app's entire access-control decision, and a decision that matters
// this much should be testable without a browser, a Google account or a
// server. Everything it needs is passed in; it reads nothing and writes
// nothing.
//
// Three ways through, and deliberately no fourth:
//
// 1. An invite exists for this address. The ordinary case.
// 2. The cellar is unclaimed and OWNER_EMAIL names this address.
// 3. The cellar is unclaimed and OWNER_EMAIL is unset - the bootstrap,
//    without which switching accounts on for the first time would require
//    an invite that nobody could have created yet, since creating one
//    needs an account. This closes permanently once anyone signs in.
//
// The asymmetry in 2 and 3 is the point. An unclaimed cellar is the one
// moment this app is genuinely open, and OWNER_EMAIL is how the owner
// narrows that moment to themselves.
export function maySignIn({ email, hasInvite, cellarUnclaimed, ownerEmail }) {
  const address = normalizeEmail(email);
  // No address, no decision to make: every route in depends on knowing
  // who this is, and an OAuth response without an email is not something
  // to guess around.
  if (!address) return false;

  if (hasInvite) return true;
  if (!cellarUnclaimed) return false;

  const restrictedTo = normalizeEmail(ownerEmail);
  return restrictedTo ? address === restrictedTo : true;
}

// Stored and compared lowercased everywhere, so Invite.email's unique
// constraint means what it looks like it means and "Andrew@..." cannot
// slip past an invite written "andrew@...".
export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
