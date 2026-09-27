"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The first five match TabBar.js's phone tabs, in the same order - they
// used to disagree (a different order, and no Pairings at all here, per
// BACKLOG #29's polish note) with nothing keeping the two in sync since
// they're two separate lists in two separate files. The rest (Wishlist,
// Flights, Tasting notes) don't fit a 5-tab phone bar and are reached
// there via a Home card instead - but a wide desktop screen has room to
// keep them one click away, which is a deliberate difference from the
// phone nav, not drift from it.
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/suggest", label: "Suggest" },
  { href: "/pairings", label: "Pairings" },
  { href: "/scan", label: "Scan" },
  { href: "/inventory", label: "Cellar" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/flights", label: "Flights" },
  { href: "/consumed", label: "Tasting notes" },
];

export default function NavLinks() {
  const pathname = usePathname();

  return NAV_LINKS.map((link) => {
    const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={
          active
            ? "font-medium underline decoration-2 underline-offset-4"
            : "font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        }
      >
        {link.label}
      </Link>
    );
  });
}
