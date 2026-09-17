"use client";

import { useState } from "react";
import Link from "next/link";
import { ScanIcon } from "@/app/components/icons";

// Scan and hand entry, on one line, wherever a list page offers both ways
// in. Scan stays the primary control - the bordered button a scan reaches
// for standing in front of the rack keeps its prominence - and hand entry
// is the smaller text control beside it: the same relative weight the
// Cellar page already gave it when the two were stacked, just horizontal
// now (BACKLOG #26).
//
// Cellar and Wishlist share this rather than each keeping its own version.
// They used to differ in how much weight hand entry got - deliberately,
// once, when adding-vs-browsing frequency differs enough between the two
// pages to earn it - but that's not a distinction worth two markups now
// that both want the same one-line layout and the same answer (Scan wins).
//
// A plain button-and-state disclosure rather than <details>/<summary>: the
// trigger has to sit beside Scan in a flex row while its content expands to
// the row's full width below, and <summary> only behaves as the disclosure
// widget when it's a direct child of <details> - it can't be nested inside
// a flex wrapper next to something else and still keep that behavior.
export default function ScanAndAddRow({ scanHref, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Link
          href={scanHref}
          className="flex flex-1 items-center justify-center gap-2.5 rounded-lg border border-zinc-300 px-4 py-3 font-medium hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
        >
          <ScanIcon className="h-5 w-5" />
          Scan
        </Link>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="shrink-0 rounded px-1 text-sm text-zinc-600 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:text-zinc-400 dark:focus-visible:outline-zinc-100"
        >
          <span aria-hidden="true">{open ? "▾" : "▸"}</span> Add by hand
        </button>
      </div>

      {open && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          {children}
        </div>
      )}
    </div>
  );
}
