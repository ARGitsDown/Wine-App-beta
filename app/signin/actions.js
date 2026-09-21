"use server";

import { signIn, signOut } from "@/lib/auth";

// Its own file rather than app/actions.js: everything there is about
// wine, and these are the only actions in the app that are about the door
// rather than the cellar.
export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

// Takes the raw FormData a plain form action receives, the same shape
// every other unstyled form action in this app is called with - no
// separate parsing step, since the one field is read here and nowhere
// else needs it. Normalizing and validating the address is the provider's
// job (see defaultNormalizer in @auth/core), not this action's - it would
// only be duplicating a check that runs server-side regardless.
export async function signInWithEmail(formData) {
  const email = String(formData.get("email") || "").trim();
  await signIn("resend", { email, redirectTo: "/" });
}

export async function signOutOfCellar() {
  await signOut({ redirectTo: "/signin" });
}
