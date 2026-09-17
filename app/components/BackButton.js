"use client";

import { useRouter } from "next/navigation";
import { hasBackTarget } from "@/app/components/NavigationDepthTracker";

// The app installs as a standalone PWA (no browser chrome, no back
// button), and a bottle's page in particular is reached from half a dozen
// places - the cellar, the wishlist, a flight, a pairing, tasting history -
// so landing on it with nothing pointing back left the tab bar as the only
// way out, which jumps to a top-level tab instead of wherever you actually
// came from.
//
// `router.back()` only makes sense if this tab actually has an app page
// behind the current one - a deep link opened fresh (a bookmark, a shared
// URL) does not, and calling it there can walk the tab out of the app
// entirely. NavigationDepthTracker says whether that's the case;
// `fallbackHref` is where Back sends you when it isn't.
export default function BackButton({ fallbackHref, label = "Back" }) {
  const router = useRouter();

  function handleClick() {
    if (hasBackTarget()) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex w-fit items-center gap-1 text-sm text-zinc-500 underline underline-offset-2"
    >
      ← {label}
    </button>
  );
}
