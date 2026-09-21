import { redirect } from "next/navigation";
import { auth, isAuthConfigured, isGoogleConfigured, isEmailConfigured } from "@/lib/auth";
import { signInWithGoogle, signInWithEmail } from "@/app/signin/actions";

export const dynamic = "force-dynamic";

// Outside the (owner) route group on purpose: it is the one page a signed
// out person is supposed to reach, so it must not render the owner shell
// or sit behind the guard that sends people here.
export default async function SignInPage({ searchParams }) {
  const { error } = await searchParams;

  // Nothing to sign in to. Rather than show a button that cannot work,
  // say plainly what state the app is in - this is the normal state until
  // the owner sets up at least one provider, not a fault.
  if (!isAuthConfigured()) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Sign-in isn&apos;t switched on</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This cellar is still running as a single-owner app, with no
          accounts and no sign-in. Everything works; there is just no door
          to come through, so there is nothing to do here.
        </p>
        <p className="text-sm text-zinc-500">
          Whoever runs it can switch accounts on by setting{" "}
          <code className="text-xs">AUTH_SECRET</code> plus either{" "}
          <code className="text-xs">AUTH_GOOGLE_ID</code> /{" "}
          <code className="text-xs">AUTH_GOOGLE_SECRET</code> or{" "}
          <code className="text-xs">AUTH_RESEND_KEY</code> /{" "}
          <code className="text-xs">AUTH_RESEND_FROM</code> — see{" "}
          <code className="text-xs">.env.example</code>.
        </p>
      </div>
    );
  }

  const google = isGoogleConfigured();
  const email = isEmailConfigured();

  // Already in. Bouncing rather than showing a second sign-in button
  // avoids the state where signing in again quietly swaps accounts.
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Cellarmaster</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to reach your cellar. This app is invite-only, so the
          account you use has to be one that was invited.
        </p>
      </div>

      {/* Auth.js reports refusals by redirecting back here with ?error, so
          the most likely failure - a real address that simply is not on
          the list - has to say so in words rather than leaving someone to
          conclude their account is broken. Worded for either door: it is
          shown identically whichever one was tried. */}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 p-3 text-sm dark:border-amber-900"
        >
          {error === "AccessDenied"
            ? "That address hasn't been invited to this cellar. If you think it should have been, ask whoever runs it to add it."
            : "That sign-in didn't complete. Please try again."}
        </p>
      )}

      {google && (
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full rounded bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Continue with Google
          </button>
        </form>
      )}

      {/* A rule rather than a divider glyph: two options need one line
          saying that either works, not just a line drawn between them. */}
      {google && email && (
        <p className="text-center text-xs uppercase tracking-wide text-zinc-400">or</p>
      )}

      {email && (
        <form action={signInWithEmail} className="flex flex-col gap-2">
          <label htmlFor="signin-email" className="sr-only">
            Email address
          </label>
          <input
            id="signin-email"
            type="email"
            name="email"
            required
            placeholder="your@email.com"
            className="rounded border border-zinc-300 px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="w-full rounded border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700"
          >
            Email me a sign-in link
          </button>
        </form>
      )}

      <p className="text-sm text-zinc-500">
        Browsing someone else&apos;s cellar as a guest?{" "}
        <a href="/guest" className="underline underline-offset-2">
          You don&apos;t need an account for that.
        </a>
      </p>
    </div>
  );
}
