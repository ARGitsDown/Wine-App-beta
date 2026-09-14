import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  ScanIcon,
  SuggestIcon,
  InventoryIcon,
  WishlistIcon,
  TastingHistoryIcon,
  FlightsIcon,
} from "@/app/components/icons";

export const dynamic = "force-dynamic";

const sectionLabelClass =
  "text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500";

const cardClass =
  "flex flex-col gap-2 rounded-xl border border-zinc-200 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-600";

function Card({ card }) {
  return (
    <Link href={card.href} className={cardClass}>
      {/* Icon and count share a row. Stacked, they cost a line per card,
          which across six cards was most of a phone screen. */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${card.accent}`}
        >
          <card.Icon className="h-5 w-5" />
        </span>
        {/* Only the collections carry a number. Scan and Suggest are things
            you do rather than piles of bottles, and a count on them would
            either be meaningless or quietly invented. */}
        {card.count !== undefined && (
          <span className="text-xl font-semibold leading-none">{card.count}</span>
        )}
      </div>
      <div>
        <div className="text-sm font-medium">{card.label}</div>
        <div className="text-xs text-zinc-500">{card.description}</div>
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [inventoryCount, wishlistCount, tastingNoteCount, flightCount] =
    await Promise.all([
      prisma.bottle.count({ where: { status: "inventory" } }),
      prisma.bottle.count({ where: { status: "wishlist" } }),
      prisma.tastingNote.count(),
      prisma.tastingFlight.count(),
    ]);

  const collections = [
    {
      href: "/inventory",
      label: "Inventory",
      count: inventoryCount,
      description: "Bottles currently in your cellar",
      Icon: InventoryIcon,
      accent: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
    },
    {
      href: "/wishlist",
      label: "Wishlist",
      count: wishlistCount,
      description: "Bottles to try or buy",
      Icon: WishlistIcon,
      accent: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    {
      href: "/consumed",
      label: "Tasting history",
      count: tastingNoteCount,
      description: "Tasting notes logged",
      Icon: TastingHistoryIcon,
      accent: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
    },
    {
      href: "/flights",
      label: "Flights",
      count: flightCount,
      description: "Themed flights saved from Suggest",
      Icon: FlightsIcon,
      accent:
        "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
    },
  ];

  const actions = [
    {
      href: "/scan",
      label: "Scan",
      description: "Read a label or tasting sheet from a photo",
      Icon: ScanIcon,
      accent:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    },
    {
      href: "/suggest",
      label: "Suggest",
      description: "What to open tonight, or a flight to build",
      Icon: SuggestIcon,
      accent:
        "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
      {/* No tagline under the title: six labelled cards say what the app
          holds more precisely than a sentence summarising three of them. */}
      <h1 className="text-2xl font-semibold">Wine tracker</h1>

      {/* Start here sits first: on a phone this is the top of the screen,
          and scanning a label or asking what to open is more often why
          you opened the app than reading a count is. */}
      <div className="flex flex-col gap-2">
        <h2 className={sectionLabelClass}>Start here</h2>
        {/* Two across even on the narrowest phone. One card per row read
            as a stack of banners and pushed Flights off the screen. */}
        <div className="grid grid-cols-2 gap-3">
          {actions.map((card) => (
            <Card key={card.href} card={card} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className={sectionLabelClass}>Your wines</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {collections.map((card) => (
            <Card key={card.href} card={card} />
          ))}
        </div>
      </div>

      <a
        href="/export"
        className="self-start text-sm text-zinc-500 underline underline-offset-2"
      >
        Export all your data (JSON backup) →
      </a>
    </div>
  );
}
