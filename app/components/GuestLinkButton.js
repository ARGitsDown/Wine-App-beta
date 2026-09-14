"use client";

import { useState } from "react";

// The guest link used to be plain text ("share /guest with friends"), which
// meant retyping it by hand to actually send it to anyone. The origin is
// only known in the browser, and it's read on click rather than during
// render so there's nothing for the server and client to disagree about.
export default function GuestLinkButton() {
  const [state, setState] = useState("idle"); // idle | copied | failed

  async function share() {
    const url = `${window.location.origin}/guest`;

    // On a phone this opens the real share sheet, which is how someone
    // would actually send this to a friend. Everywhere else, copy.
    if (navigator.share) {
      try {
        await navigator.share({ title: "Browse my cellar", url });
        return;
      } catch {
        // Dismissing the share sheet throws; fall through to copying
        // rather than reporting that as a failure.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="rounded border border-zinc-300 px-2 py-0.5 font-mono text-xs hover:border-zinc-400 dark:border-zinc-700"
      >
        /guest
      </button>
      {state === "copied" && (
        <span className="text-xs text-green-700 dark:text-green-400">Link copied</span>
      )}
      {state === "failed" && (
        <span className="text-xs text-zinc-500">
          Couldn&apos;t copy — the link is this site&apos;s address + /guest
        </span>
      )}
    </span>
  );
}
