import Link from "next/link";

export const dynamic = "force-dynamic";

// Where Auth.js sends a sign-in it refused or couldn't finish - named as
// `pages.error` in lib/auth.js. Without it, a refusal landed on Auth.js's
// own generic page, served straight from @auth/core: unstyled, outside
// this app entirely, and saying "Access Denied" with nothing about why or
// what to do next.
//
// Which errors arrive here rather than back on /signin is Auth.js's call,
// not this app's: errors of kind "error" come here (AccessDenied,
// Verification, Configuration), and sign-in-step errors (a provider
// hiccup, an address already linked to the other door) go to /signin's
// own ?error message instead. See the error classes in @auth/core's
// errors.js for which is which.
//
// Deliberately not specific about *why* an address was refused. "Never
// invited", "invite revoked" and "removed from the Domaine" all look the
// same from here, and telling a stranger which addresses were once on the
// list would be telling them something about who uses this app. The
// person who runs the cellar knows; that's who this page points at.
const MESSAGES = {
  AccessDenied: {
    title: "This address can't sign in here",
    body: "Cellarmaster is invite-only, and that address isn't on the list: it was never invited, or its access has been taken away. If you think it should be, ask whoever runs the cellar to invite it.",
    // The commonest real cause, so it gets its own line: someone with a
    // work and a personal Google account who picked the uninvited one.
    hint: "Have more than one Google account? Make sure you picked the one that was invited.",
    retry: "Try a different address",
  },
  Verification: {
    title: "That sign-in link has expired",
    body: "Each link works once and only for 24 hours. This one has already been used or has run out — ask for a fresh one and use the newest email.",
    retry: "Send a new link",
  },
};

const FALLBACK = {
  title: "Sign-in didn't work",
  body: "Something went wrong on our side, not yours. Try again in a moment; if it keeps happening, let whoever runs the cellar know.",
  retry: "Try again",
};

export default async function SignInErrorPage({ searchParams }) {
  const { error } = await searchParams;
  const message = MESSAGES[error] ?? FALLBACK;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">{message.title}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{message.body}</p>
      {message.hint && <p className="text-sm text-zinc-500">{message.hint}</p>}
      <Link
        href="/signin"
        className="flex min-h-11 w-full items-center justify-center rounded bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        {message.retry}
      </Link>
    </div>
  );
}
