import { prisma } from "@/lib/prisma";
import { getCurrentGuest } from "@/lib/guest";
import { enterAsGuest, switchGuest, toggleFavorite } from "@/app/actions";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

function bottleHeader(bottle) {
  return [bottle.producer, bottle.bottling ? `“${bottle.bottling}”` : null, bottle.vintage || null]
    .filter(Boolean)
    .join(" ");
}

export default async function GuestPage() {
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

  const bottles = await prisma.bottle.findMany({
    where: { status: "inventory" },
    include: { favorites: { where: { guestId: guest.id } } },
    orderBy: { producer: "asc" },
  });

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

      {bottles.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing in the cellar yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {bottles.map((bottle) => {
            const favorited = bottle.favorites.length > 0;
            return (
              <li
                key={bottle.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-4 py-2.5 dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium">
                    {bottleHeader(bottle)}
                    {bottle.type ? ` — ${bottle.type}` : ""}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {[bottle.variety, bottle.region, bottle.country].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <form action={toggleFavorite.bind(null, bottle.id)}>
                  <button
                    type="submit"
                    className="shrink-0 text-xl leading-none"
                    aria-label={favorited ? "Remove favorite" : "Favorite this bottle"}
                  >
                    {favorited ? "❤️" : "🤍"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
