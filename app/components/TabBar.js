import { Suspense } from "react";
import { connection } from "next/server";
import { getResearchCount } from "@/lib/bottles";
import TabBarLinks from "@/app/components/TabBarLinks";
import {
  HomeIcon,
  ScanIcon,
  CellarIcon,
  SuggestIcon,
} from "@/app/components/icons";

// Four destinations, chosen by the owner from a contact sheet of the
// alternatives: the two things you do (Scan, Suggest), the one list you
// live in (Cellar), and the way back to everything else. Wishlist, tasting
// notes, flights, research and kept pairings are all home cards, so nothing
// is unreachable - it is one more tap, not a dead end.
//
// Phone only. Above 640px the original top row comes back: a bar pinned to
// the bottom edge of a laptop screen is a long way from the mouse, and the
// wrapping this replaces only ever happened on a phone.
const TABS = [
  { href: "/", label: "Home", icon: <HomeIcon className="h-[21px] w-[21px]" /> },
  { href: "/scan", label: "Scan", icon: <ScanIcon className="h-[21px] w-[21px]" /> },
  {
    href: "/inventory",
    label: "Cellar",
    icon: <CellarIcon className="h-[21px] w-[21px]" />,
  },
  {
    href: "/suggest",
    label: "Suggest",
    icon: <SuggestIcon className="h-[21px] w-[21px]" />,
  },
];

// Research did not get a tab, so its count needs somewhere else to live on
// a phone. A dot on Home says something is waiting without spending a slot
// on a queue that is empty most of the time; the number itself is on the
// card you land on. Its own async component for the same reason the nav
// link is - so a database round-trip isn't in front of every owner page -
// and both read the same per-request cached count.
async function HomeBadge() {
  await connection();
  const count = await getResearchCount();
  if (count === 0) return null;

  return (
    <span
      // Not aria-hidden: the dot is the only thing on a phone saying there
      // is research waiting, so it has to say so in words too.
      role="status"
      aria-label={`${count} ${count === 1 ? "bottle" : "bottles"} waiting on research`}
      className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-zinc-950"
    />
  );
}

export default function TabBar() {
  const items = TABS.map((tab) =>
    tab.href === "/"
      ? {
          ...tab,
          badge: (
            <Suspense fallback={null}>
              <HomeBadge />
            </Suspense>
          ),
        }
      : tab
  );

  return <TabBarLinks items={items} />;
}
