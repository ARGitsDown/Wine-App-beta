"use client";

import Link from "next/link";

// The fallback shown when something throws. Until this existed, anything
// uncaught landed on Next's own blank page: most server actions catch
// deliberately - the comment at insertBottle explains why one scan card's
// database error must not take the batch down - but an action that doesn't
// catch threw all the way to the root, and on the scan screen that meant a
// page of unreviewed cards replaced by nothing, with nothing to click.
//
// This makes no promise about recovering what was on screen: by the time it
// renders, the client state holding those cards is gone. What it offers is
// the honest thing - say what happened in words, and give a way back.
// retry() re-fetches and re-renders the segment, which is what fixes the
// transient case this mostly catches.
export default function ErrorScreen({ error, retry }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">That didn&apos;t work</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Something went wrong loading this page. It&apos;s usually temporary, so
        trying again is worth a shot.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:focus-visible:outline-zinc-100"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:focus-visible:outline-zinc-100"
        >
          Back to the home screen
        </Link>
      </div>

      {/* A server error's real message never reaches the browser, on purpose.
          The digest is the one thread back to it in the server logs, so it is
          worth showing rather than swallowing. */}
      {error?.digest && (
        <p className="text-xs text-zinc-500">
          If it keeps happening, this code identifies what failed:{" "}
          <code className="font-mono">{error.digest}</code>
        </p>
      )}
    </div>
  );
}
