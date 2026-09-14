import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  BottleIcon,
  HeartIcon,
  ClockIcon,
  CameraIcon,
  SparkleIcon,
  FlightIcon,
} from "@/app/components/icons";

export const dynamic = "force-dynamic";

const cardClass =
  "flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-600";

function Card({ card }) {
  return (
    <Link href={card.href} className={cardClass}>
      <span
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${card.accent}`}
      >
        <card.Icon />
      </span>
      <div>
        {/* Only the collections carry a number. Scan and Suggest are things
            you do rather than piles of bottles, and a count on them would
            either be meaningless or quietly invented. */}
        {card.count !== undefined && (
          <div className="text-2xl font-semibold">{card.count}</div>
        )}
        <div className="font-medium">{card.label}</div>
        <div className="text-sm text-zinc-500">{card.description}</div>
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
      Icon: BottleIcon,
      accent: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
    },
    {
      href: "/wishlist",
      label: "Wishlist",
      count: wishlistCount,
      description: "Bottles to try or buy",
      Icon: HeartIcon,
      accent: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    {
      href: "/consumed",
      label: "Tasting history",
      count: tastingNoteCount,
      description: "Tasting notes logged",
      Icon: ClockIcon,
      accent: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
    },
    {
      href: "/flights",
      label: "Flights",
      count: flightCount,
      description: "Themed flights saved from Suggest",
      Icon: FlightIcon,
      accent:
        "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
    },
  ];

  const actions = [
    {
      href: "/scan",
      label: "Scan",
      description: "Read a label or tasting sheet from a photo",
      Icon: CameraIcon,
      accent:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    },
    {
      href: "/suggest",
      label: "Suggest",
      description: "What to open tonight, or a flight to build",
      Icon: SparkleIcon,
      accent:
        "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-3xl font-semibold">Wine tracker</h1>
        <p className="mt-1 text-zinc-500">
          Your cellar, wishlist, and tasting notes in one place.
        </p>
      </div>

      {/* Start here sits first: on a phone this is the top of the screen,
          and scanning a label or asking what to open is more often why
          you opened the app than reading a count is. */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Start here
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {actions.map((card) => (
            <Card key={card.href} card={card} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Your wines
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
