"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/scan", label: "Scan" },
  { href: "/suggest", label: "Suggest" },
  { href: "/flights", label: "Flights" },
  { href: "/inventory", label: "Inventory" },
  { href: "/wishlist", label: "Wishlist" },
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
