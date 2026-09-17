"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Module-scope, not state or sessionStorage: this needs to survive
// exactly as long as the tab's current JS runtime does (a full reload
// clears it, same as the browser's own history), and it needs to stay
// correct under React's dev-mode double-invoked mount effect - two
// invocations for the same pathname are a no-op here, so only a genuine
// pathname change ever flips this to true. A sessionStorage read-then-
// write in the same spot would double-count on that first mount instead.
let lastSeenPathname = null;
let hasNavigatedWithinApp = false;

export function hasBackTarget() {
  return hasNavigatedWithinApp;
}

// Mounted once, in the owner layout, so it runs on every owner page -
// invisibly noting whether this tab has rendered more than one distinct
// page this session. BackButton reads it to tell a same-tab click-through
// (there's a real page behind this one) from a fresh deep link (there's
// nothing behind it but about:blank or another site) - `history.length`
// doesn't draw that line the same way across browsers and can send Back
// straight out of a standalone PWA with no chrome to recover with.
export default function NavigationDepthTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (lastSeenPathname === null) {
      lastSeenPathname = pathname;
    } else if (lastSeenPathname !== pathname) {
      hasNavigatedWithinApp = true;
      lastSeenPathname = pathname;
    }
  }, [pathname]);

  return null;
}
