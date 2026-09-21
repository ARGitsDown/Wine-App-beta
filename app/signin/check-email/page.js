// Auth.js's own page for this moment is a generic themed page served
// straight from @auth/core, outside this app's design entirely - a visible
// seam on the one screen a first-time sign-in most depends on. Named here
// as `pages.verifyRequest` in lib/auth.js instead.
//
// Reaching this page at all means the address was allowed through: an
// uninvited one is refused earlier, during the send step (see
// isAllowedToSignIn in lib/auth.js, called before sendVerificationRequest
// ever runs), and lands back on /signin with an error rather than here. So
// this page can say the link is on its way without hedging - there is
// nothing left to have gone wrong that it needs to leave room for.
//
// What it deliberately cannot say is *which* address, or confirm the
// email actually arrived: Auth.js's redirect here carries the provider
// name, not the identifier, and confirming delivery isn't something this
// page is in a position to know. "Check your inbox" is what's true.
export default function CheckEmailPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        A sign-in link is on its way. It&apos;s good for 24 hours and works
        once — request a fresh one from{" "}
        <a href="/signin" className="underline underline-offset-2">
          the sign-in page
        </a>{" "}
        if it&apos;s expired.
      </p>
      <p className="text-sm text-zinc-500">
        Nothing turned up? Check spam, and confirm the address is the exact
        one that was invited.
      </p>
    </div>
  );
}
