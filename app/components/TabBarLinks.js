"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The interactive half of the tab bar: which tab is lit. Split from the
// server half only so the icons can stay where they are - app/components/
// icons.js builds its shapes at module load and says it is never imported
// by a client component, and a tab bar that imported it would quietly ship
// all that geometry to the browser. The icons arrive here as already-
// rendered elements instead.
//
// `items` is [{ href, label, icon, badge }]. `badge` is a node rather than
// a count: what goes on Home is a dot saying something is waiting, and the
// number itself belongs on the card you land on, not on a 21px icon.
export default function TabBarLinks({ items }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      // Sits above the content, and out of the way of an iPhone's home
      // indicator - without the safe-area inset the last row of a list ends
      // up under the bar on exactly the device this is for.
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <ul className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          // Home only matches itself; everything else matches its own
          // subtree. A bottle's page lights nothing, which is honest - it
          // is reached from the cellar, the wishlist and history alike, so
          // claiming any one of them would be a guess.
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                // 56px tall: a tab bar is thumb-sized or it is decoration.
                className={`relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 ${
                  active
                    ? "font-medium text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500"
                }`}
              >
                <span className="relative">
                  {item.icon}
                  {item.badge}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
