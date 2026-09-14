import { prisma } from "@/lib/prisma";
import { getCurrentGuest } from "@/lib/guest";
import { getRegionOptions } from "@/lib/bottles";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { enterAsGuest, switchGuest } from "@/app/actions";
import GuestBottleList from "@/app/components/GuestBottleList";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function GuestPage({ searchParams }) {
  const guest = await getCurrentGuest();

  if (!guest) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Who&apos;s visiting?</h1>
          <p className="text-sm text-zinc-500">
            Enter your name to browse the cellar and favorite anything
            you&apos;d like pulled for your next visit.
          </p>
        </div>
        <form action={enterAsGuest} className="flex flex-col gap-3">
          <input name="name" required placeholder="Your name" className={inputClass} />
          <button
            type="submit"
            className="self-start rounded bg-zinc-900 px-4 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  const [rows, regionOptions, filters] = await Promise.all([
    prisma.bottle.findMany({
      where: { status: "inventory" },
      include: { favorites: { where: { guestId: guest.id }, select: { id: true } } },
      orderBy: { producer: "asc" },
    }),
    getRegionOptions(),
    searchParams,
  ]);

  const bottles = rows.map(({ favorites, ...bottle }) => ({
    ...bottle,
    favorited: favorites.length > 0,
    // Same fallback as getBottles(): an older row saved before this column
    // existed still filters by grape synonym correctly.
    canonicalVariety: bottle.canonicalVariety ?? canonicalizeVarietal(bottle.type, bottle.variety),
  }));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {guest.name}</h1>
          <p className="text-sm text-zinc-500">
            Favorite anything you&apos;d like pulled for your next visit.
          </p>
        </div>
        <form action={switchGuest}>
          <button type="submit" className="text-xs text-zinc-500 underline underline-offset-2">
            Not you?
          </button>
        </form>
      </div>

      <GuestBottleList
        bottles={bottles}
        regionOptions={regionOptions}
        initialFilters={filters}
      />
    </div>
  );
}
