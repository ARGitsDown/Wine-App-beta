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

const cardClass =
  "flex min-h-28 flex-col justify-between gap-3.5 rounded-xl border border-zinc-200 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-600";

function Card({ card }) {
  const hasCount = card.count !== undefined;

  return (
    <Link href={card.href} className={cardClass}>
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${card.accent}`}
        >
          <card.Icon className="h-7 w-7" />
        </span>
        <span className="text-base font-medium">{card.label}</span>
      </div>

      {/* Only the collections carry a number. Scan and Suggest are things
          you do rather than piles of bottles, and a count on them would
          either be meaningless or quietly invented - so their description
          takes the whole bottom row instead of sitting beside a gap. */}
      {hasCount ? (
        <div className="flex items-end justify-between gap-2">
          {/* The same width as the icon above it, centred: the figure reads
              as belonging to that icon rather than to the card's edge. */}
          <span className="w-11 shrink-0 text-center text-[26px] font-semibold leading-none tabular-nums">
            {card.count}
          </span>
          <span className="text-right text-[12.5px] text-zinc-500">
            {card.description}
          </span>
        </div>
      ) : (
        <span className="text-[12.5px] text-zinc-500">{card.description}</span>
      )}
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

  // Actions first: on a phone this is the top of the screen, and scanning a
  // label or asking what to open is more often why you opened the app than
  // reading a count is.
  const cards = [
    {
      href: "/scan",
      label: "Scan",
      description: "Read a label or tasting sheet",
      Icon: ScanIcon,
      accent:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    },
    {
      href: "/suggest",
      label: "Suggest",
      description: "What to open tonight",
      Icon: SuggestIcon,
      accent:
        "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400",
    },
    {
      href: "/inventory",
      label: "Inventory",
      count: inventoryCount,
      description: "Bottles in your cellar",
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
      description: "Themed flights saved",
      Icon: FlightsIcon,
      accent:
        "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {/* The cards are the screen now - no title, no section labels. The
          heading stays for screen readers, which would otherwise land on a
          page with nothing naming it. */}
      <h1 className="sr-only">Wine tracker</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.href} card={card} />
        ))}
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
