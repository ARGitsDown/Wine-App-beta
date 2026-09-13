import Link from "next/link";
import { prisma } from "@/lib/prisma";

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
    },
    {
      href: "/wishlist",
      label: "Wishlist",
      count: wishlistCount,
      description: "Bottles to try or buy",
    },
    {
      href: "/consumed",
      label: "History",
      count: tastingNoteCount,
      description: "Tasting notes logged",
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
            className="rounded-lg border border-zinc-200 p-5 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
          >
            <div className="text-2xl font-semibold">{card.count}</div>
            <div className="font-medium">{card.label}</div>
            <div className="text-sm text-zinc-500">{card.description}</div>
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
