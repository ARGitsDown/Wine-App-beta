"use server";

import { signIn, signOut } from "@/lib/auth";

// Its own file rather than app/actions.js: everything there is about
// wine, and these two are the only actions in the app that are about the
// door rather than the cellar.
export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutOfCellar() {
  await signOut({ redirectTo: "/signin" });
}
