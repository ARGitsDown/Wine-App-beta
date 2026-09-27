"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";

// Auth.js's server-side signIn() *throws* a refusal rather than
// redirecting the way its own HTTP endpoints do - so an uninvited address
// typed into the email form used to surface as the app's generic "That
// didn't work, try again" error boundary, which is both wrong ("again"
// fails the same way) and silent about why. This routes it exactly where
// Auth.js itself would: sign-in-step errors (kind "signIn") back to
// /signin's own ?error message, everything else - AccessDenied above all
// - to /signin/error. Anything that isn't an AuthError is rethrown
// untouched, and that includes the redirect a *successful* signIn()
// throws to send the browser on its way.
async function signInOrExplain(provider, options) {
  try {
    await signIn(provider, options);
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    const page = error.kind === "signIn" ? "/signin" : "/signin/error";
    redirect(`${page}?error=${encodeURIComponent(error.type)}`);
  }
}

// Its own file rather than app/actions.js: everything there is about
// wine, and these are the only actions in the app that are about the door
// rather than the cellar.
export async function signInWithGoogle() {
  await signInOrExplain("google", { redirectTo: "/" });
}

// Takes the raw FormData a plain form action receives, the same shape
// every other unstyled form action in this app is called with - no
// separate parsing step, since the one field is read here and nowhere
// else needs it. Normalizing and validating the address is the provider's
// job (see defaultNormalizer in @auth/core), not this action's - it would
// only be duplicating a check that runs server-side regardless.
export async function signInWithEmail(formData) {
  const email = String(formData.get("email") || "").trim();
  await signInOrExplain("resend", { email, redirectTo: "/" });
}

export async function signOutOfCellar() {
  await signOut({ redirectTo: "/signin" });
}
