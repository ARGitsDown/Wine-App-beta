import Link from "next/link";
import { db } from "@/lib/scoped-prisma";
import {
  ScanIcon,
  SuggestIcon,
  CellarIcon,
  WishlistIcon,
  TastingHistoryIcon,
  FlightsIcon,
  PairingsIcon,
  ResearchIcon,
} from "@/app/components/icons";
import { getResearchCount } from "@/lib/bottles";

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
        /* Two columns, top to bottom: the icon and the count share the left
           one at the same 44px width, so the figure sits under its icon;
           the name and the description share the right one, both starting
           at the same edge. The description centres on the count rather
           than sitting on its baseline, which left it looking dropped. */
        <div className="flex items-center gap-2.5">
          <span className="w-11 shrink-0 text-center text-[26px] font-semibold leading-none tabular-nums">
            {card.count}
          </span>
          <span className="text-[12.5px] text-zinc-500">{card.description}</span>
        </div>
      ) : (
        <span className="text-[12.5px] text-zinc-500">{card.description}</span>
      )}
    </Link>
  );
}

export default async function HomePage() {
  const [
    inventoryCount,
    wishlistCount,
    tastedCount,
    flightCount,
    pairingCount,
    researchCount,
  ] = await Promise.all([
      db.bottle.count({ where: { status: "inventory" } }),
      db.bottle.count({ where: { status: "wishlist" } }),
      // Wines tasted, not notes written. A bottle you finished without
      // writing anything down still counts - knowing you have had a wine
      // before is the useful fact, and it does not depend on having had
      // something to say about it. Counted per bottle row, which is a wine
      // rather than an individual bottle, so three of the same Rochioli is
      // one wine tasted.
      db.bottle.count({
        where: { OR: [{ status: "consumed" }, { tastingNotes: { some: {} } }] },
      }),
      db.tastingFlight.count(),
      db.savedPairing.count(),
      getResearchCount(),
    ]);

  // Two columns, ordered by how often each one is actually reached for
  // (BACKLOG #25) - authored as two plain arrays, left column first, so the
  // order below reads the same way it was asked for: top to bottom, one
  // column, then the other. (The render below concatenates them and lets
  // grid-auto-flow: column turn that flat, readable order into the two
  // side-by-side stacks - see the comment there.)
  //
  // The heuristic, spelled out because the array order used to be the only
  // place it lived:
  //   (a) an action - a thing you *do* (Scan, Suggest) - outranks a
  //       collection - a thing you *browse* - because doing it is more
  //       often why the app was opened than checking a count. That holds
  //       within each column, not just once across the whole screen, which
  //       is why an action leads both of them.
  //   (b) within a column, order by how often it's actually reached for -
  //       the owner's own sense of their use, revisited by asking again if
  //       it stops matching reality, not by tracking clicks for eight
  //       cards in a single-user app.
  //   (c) a pair that feeds into each other stays adjacent when that
  //       doesn't conflict with (a) or (b) - Suggest produces what
  //       Pairings holds, so Pairings follows it here.
  const leftCards = [
    {
      href: "/suggest",
      label: "Suggest",
      description: "What to open tonight",
      Icon: SuggestIcon,
      accent:
        "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-400",
    },
    // Reachable from exactly one other place - Suggest itself - before the
    // tab bar existed. With four tabs, home is the way to everything not
    // in the bar, so it needs a card here regardless of column order.
    {
      href: "/pairings",
      label: "Pairings",
      count: pairingCount,
      description: "Kept",
      Icon: PairingsIcon,
      accent: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400",
    },
    {
      href: "/flights",
      label: "Flights",
      count: flightCount,
      description: "Curated",
      Icon: FlightsIcon,
      accent:
        "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
    },
    {
      href: "/consumed",
      label: "Tasting notes",
      count: tastedCount,
      description: "Wines tasted",
      Icon: TastingHistoryIcon,
      accent: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
    },
  ];
  const rightCards = [
    {
      href: "/scan",
      label: "Scan",
      description: "Label or tasting sheet",
      Icon: ScanIcon,
      accent:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    },
    // The other card with nowhere to live before the tab bar - a nav badge
    // that vanished once its count hit zero, rather than a route of its
    // own.
    {
      href: "/research",
      label: "Research",
      count: researchCount,
      description: "Waiting on a look",
      Icon: ResearchIcon,
      accent:
        "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    },
    {
      href: "/wishlist",
      label: "Wishlist",
      count: wishlistCount,
      description: "To try or buy",
      Icon: WishlistIcon,
      accent: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    },
    {
      href: "/inventory",
      label: "Cellar",
      count: inventoryCount,
      description: "Bottles",
      Icon: CellarIcon,
      accent: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      {/* The cards are the screen now - no title, no section labels. The
          heading stays for screen readers, which would otherwise land on a
          page with nothing naming it. */}
      <h1 className="sr-only">Cellarmaster</h1>

      {/* grid-flow-col fills a column at a time in DOM order rather than
          grid's default row-major - given the flat left-then-right list
          below, that reads as exactly the two stacks asked for, and
          because it's still one real grid (not two independent flex
          columns), a card whose description wraps to a second line still
          pulls its whole row - both columns - down with it, the way plain
          grid-cols-2 always did. Two separate flex-col stacks looked
          simpler on paper but lost that: the first version of this only
          matched row heights by coincidence, and drifted a visible 12px by
          the last row once one column's cards ran taller than the
          other's - caught by measuring rather than eyeballing it. No
          lg:grid-cols-3 step-up either: a third column would have to
          decide where this two-column usage order breaks into three,
          which nothing here specifies, and the app is phone-first enough
          that losing it on a wide screen is a minor, reversible trade
          rather than a guess worth making now. */}
      <div className="grid grid-cols-2 grid-flow-col grid-rows-4 gap-3">
        {[...leftCards, ...rightCards].map((card) => (
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
