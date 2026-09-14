import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BottleIcon, HeartIcon, ClockIcon } from "@/app/components/icons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [inventoryCount, wishlistCount, tastingNoteCount] = await Promise.all([
    prisma.bottle.count({ where: { status: "inventory" } }),
    prisma.bottle.count({ where: { status: "wishlist" } }),
    prisma.tastingNote.count(),
  ]);

  const cards = [
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
      label: "History",
      count: tastingNoteCount,
      description: "Tasting notes logged",
      Icon: ClockIcon,
      accent: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
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
      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${card.accent}`}
            >
              <card.Icon />
            </span>
            <div>
              <div className="text-2xl font-semibold">{card.count}</div>
              <div className="font-medium">{card.label}</div>
              <div className="text-sm text-zinc-500">{card.description}</div>
            </div>
          </Link>
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
