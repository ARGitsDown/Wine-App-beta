import { prisma } from "@/lib/prisma";
import { getCurrentGuest } from "@/lib/guest";
import { guestOwnerId } from "@/lib/owner";
import { getRegionOptions } from "@/lib/bottles";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { enterAsGuest, switchGuest } from "@/app/actions";
import GuestBottleList from "@/app/components/GuestBottleList";

export const dynamic = "force-dynamic";

const inputClass =
  "rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900";

// The name on the invite, in the owner's own words - a display name if
// Google or the profile provided one, their email otherwise, and only
// "the owner" if somehow neither exists (a row from before either was
// required). Never null: used below for "who will see your favorites,"
// which has to name the actual person - a Domaine name (below) can't see
// anything.
function ownerDisplayName(owner) {
  return owner?.name || owner?.email || "the owner";
}

// What to call the cellar itself. The estate's own name if one was set
// (see the schema comment on Domaine.name) - already reads as a place, so
// it stands alone rather than taking a possessive - falling back to the
// person's own name otherwise, exactly as before this existed.
function cellarDisplayName(owner) {
  return owner?.domaine?.name || `${ownerDisplayName(owner)}'s cellar`;
}

// The estate's tagline, if one was set - shown after cellarDisplayName
// wherever that appears, in the owner's own words, never manufactured
// when absent.
function cellarMotto(owner) {
  return owner?.domaine?.motto || null;
}

export default async function GuestPage({ searchParams }) {
  const [guest, owner] = await Promise.all([
    getCurrentGuest(),
    // Needed before a guest even has a name of their own (BACKLOG #29
    // finding 8: the sign-in screen never said whose cellar this was, or
    // that picks are visible to them) - so this is fetched unconditionally
    // rather than only once a guest exists.
    prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { name: true, email: true, domaine: { select: { name: true, motto: true } } },
    }),
  ]);
  const ownerName = ownerDisplayName(owner);
  const cellarName = cellarDisplayName(owner);
  const motto = cellarMotto(owner);

  if (!guest) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
        <div>
          <h1 className="text-2xl font-semibold">Who&apos;s visiting?</h1>
          <p className="text-sm text-zinc-500">
            You&apos;re browsing {cellarName}
            {motto && (
              <>
                {" "}
                — <em>&ldquo;{motto}&rdquo;</em>
              </>
            )}
            . Enter your name to favorite anything you&apos;d like pulled
            for your next visit — {ownerName} will see your name next to
            what you pick.
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

  // /guest has no session for lib/scoped-prisma.js's extension to read -
  // there's no signed-in owner here at all, just a name in a cookie. This
  // is the one cellar guest browsing shows, not per-invitee (see
  // guestOwnerId in lib/owner.js for what that means and what Phase 4
  // would need to change about it).
  const ownerId = await guestOwnerId();
  const [rows, regionOptions, filters] = await Promise.all([
    prisma.bottle.findMany({
      where: { status: "inventory", ownerId },
      include: { favorites: { where: { guestId: guest.id }, select: { id: true } } },
      orderBy: { producer: "asc" },
    }),
    getRegionOptions(ownerId),
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
            Browsing {cellarName}
            {motto && (
              <>
                {" "}
                — <em>&ldquo;{motto}&rdquo;</em>
              </>
            )}
            . Favorite anything you&apos;d like pulled for your next visit
            — {ownerName} can see your name next to what you favorite.
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
