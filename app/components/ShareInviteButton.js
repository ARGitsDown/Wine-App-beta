"use client";

import { useState } from "react";

// Inviting someone writes a row and sends nothing - there is no email
// from this app - so an invite the owner doesn't pass on is one the
// invitee never hears about (BACKLOG #53, finding 3). This drafts the
// message for them: the phone's share sheet where there is one (Messages,
// WhatsApp, mail), the clipboard otherwise.
//
// The sign-in address comes from the page's own origin rather than an
// environment variable, so it is always the site the owner is actually
// using - a preview, a custom domain, whatever it is.
export default function ShareInviteButton({ email, cellarName, className }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/signin`;
    const text = `I've added you to ${cellarName} on Cellarmaster. Sign in at ${url} with ${email}.`;

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        // Dismissing the sheet is a choice, not a failure - say nothing.
        if (err?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // No share sheet and no clipboard (an old or locked-down browser):
      // the one thing left is to show the text so it can be copied by hand.
      window.prompt("Copy this and send it to them:", text);
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={
        className ??
        "min-h-11 rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
      }
    >
      {copied ? "✓ Copied" : "Share sign-in link"}
    </button>
  );
}
