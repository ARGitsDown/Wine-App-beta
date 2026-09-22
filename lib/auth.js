import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { maySignIn, normalizeEmail } from "@/lib/invite-policy";

// Phase 1 of separate cellars per user (FUTURE_CAPABILITIES.md): the app
// learns who you are, and the front door closes.
//
// The single most important property of this file is that all of it is
// *dormant until configured*. Until AUTH_SECRET and at least one provider's
// own variables are set, the app behaves exactly as it did before: one
// owner, no sign-in, every page open. That is not timidity - it is the
// only shape in which this phase can be deployed safely. A half-configured
// deploy of an app that has just started requiring sign-in is an owner
// locked out of their own cellar with no way back in, and the fix would
// have to go through the very deploy pipeline that broke it.
//
// So: ship this, confirm nothing changed, then turn it on by setting
// variables. See .env.example for what they are and where to get them.

// Google needs a Google account, full stop - not everyone invited to a
// personal cellar has or wants one. Email is the fallback with no account
// of any kind required, just an inbox: Resend's provider (a fetch call, no
// SMTP, no extra dependency) sends a one-time link, and the click carries
// the same signIn callback and the same invite check as Google does -
// nothing downstream of "who is this person" cares which door they used.
export function isGoogleConfigured() {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

// AUTH_RESEND_KEY is picked up automatically by Auth.js's own env
// inference (AUTH_<PROVIDERID>_KEY, the same pattern AUTH_GOOGLE_ID
// follows) - but that inference only fires once a provider is already in
// the array, which is exactly the chicken-and-egg this function exists to
// resolve: something has to decide whether to add it in the first place.
// AUTH_RESEND_FROM is not part of that inference (only clientId/
// clientSecret/issuer/apiKey are), so it is read here and passed
// explicitly - without it the provider falls back to its own default
// sender address, which is not this app's to send from.
export function isEmailConfigured() {
  return Boolean(process.env.AUTH_RESEND_KEY && process.env.AUTH_RESEND_FROM);
}

export function isAuthConfigured() {
  return Boolean(process.env.AUTH_SECRET) && (isGoogleConfigured() || isEmailConfigured());
}

// Only that address may claim the existing cellar, when it is set. Optional,
// and worth setting for exactly one deploy: it is the difference between
// "the first person through the door inherits 117 bottles" and "only I do".
// Once claimed it does nothing, because there is no unclaimed cellar left.
function ownerEmail() {
  const value = normalizeEmail(process.env.OWNER_EMAIL);
  return value || null;
}

// The cellar that Phase 0 seeded and nobody has signed in to yet. It is
// identified by having no email: the migration deliberately left that null
// rather than guess at a Google address, so "has an email" is exactly the
// line between a claimed account and the placeholder.
async function unclaimedOwner() {
  return prisma.user.findFirst({
    where: { email: null },
    orderBy: { createdAt: "asc" },
  });
}

// The adapter, with one method replaced.
//
// Out of the box `createUser` always inserts a new row, which would be a
// disaster exactly once: the owner's first sign-in would hand them a brand
// new empty cellar while their real one sat under the seeded placeholder,
// untouched and invisible. Nothing would be lost and it would look exactly
// like everything had been. So the first sign-in adopts the placeholder
// instead of creating beside it.
//
// After that there is no unclaimed row and this behaves like the stock
// adapter for everyone else, each of whom correctly starts empty.
function adapter() {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    async createUser(data) {
      // The adapter's own contract: it strips the id and lets the database
      // generate one, so `data` here is everything but the id.
      const { id: _ignored, ...fields } = data;
      const claimable = await unclaimedOwner();
      const restrictedTo = ownerEmail();

      if (claimable && (!restrictedTo || normalizeEmail(fields.email) === restrictedTo)) {
        console.log(`Adopting the seeded cellar for ${fields.email}.`);
        return prisma.user.update({
          where: { id: claimable.id },
          data: { ...fields, email: normalizeEmail(fields.email) || null },
        });
      }

      return prisma.user.create({
        data: { ...fields, email: normalizeEmail(fields.email) || null },
      });
    },
  };
}

// Who may sign in at all. The decision itself lives in
// lib/invite-policy.js as a pure function so it can be tested exhaustively
// without a browser or a Google account (scripts/invite-policy.test.mjs);
// this half is only the lookups it needs, plus the one side effect - an
// invite records when it was first used, so the list shows who has
// actually turned up rather than only who was asked.
async function isAllowedToSignIn(email) {
  const address = normalizeEmail(email);
  if (!address) {
    console.log("Sign-in rejected: the provider returned no email at all.");
    return false;
  }

  const invite = await prisma.invite.findUnique({ where: { email: address } });
  const claimable = await unclaimedOwner();
  const restrictedTo = ownerEmail();

  const allowed = maySignIn({
    email: address,
    hasInvite: Boolean(invite),
    cellarUnclaimed: Boolean(claimable),
    ownerEmail: restrictedTo,
  });

  // Temporary - removed once a real sign-in has been confirmed working.
  // Says exactly which of the three maySignIn paths this address hit.
  console.log(
    `Sign-in check for "${address}": hasInvite=${Boolean(invite)} ` +
      `cellarUnclaimed=${Boolean(claimable)} restrictedTo="${restrictedTo}" allowed=${allowed}`
  );

  if (allowed && invite && !invite.acceptedAt) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  }

  return allowed;
}

const config = {
  adapter: adapter(),
  // Each provider only joins the list once its own variables are set, so
  // enabling Google and enabling email are independent decisions - the
  // owner can run either alone or both together, and neither construction
  // runs with undefined credentials.
  providers: [
    ...(isGoogleConfigured() ? [Google] : []),
    ...(isEmailConfigured() ? [Resend({ from: process.env.AUTH_RESEND_FROM })] : []),
  ],
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email" },
  callbacks: {
    async signIn({ user }) {
      if (!isAuthConfigured()) return false;
      return isAllowedToSignIn(user?.email);
    },
    // The user id is what every ownership query needs, and it is not on the
    // session by default.
    async session({ session, user }) {
      if (session.user && user?.id) session.user.id = user.id;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

// Re-exported flat so the route handler can lift them straight off this
// module, which is what next-auth v5's own examples do.
export const { GET, POST } = handlers;
