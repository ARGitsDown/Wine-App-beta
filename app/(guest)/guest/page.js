import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";
import { resolveGuestView } from "@/lib/guest";
import { getRegionOptions } from "@/lib/bottles";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { signOutOfCellar } from "@/app/signin/actions";
import GuestBottleList from "@/app/components/GuestBottleList";

export const dynamic = "force-dynamic";

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
function cellarDisplayName(domaine, owner) {
  return domaine?.name || `${ownerDisplayName(owner)}'s cellar`;
}

// The estate's tagline, if one was set - shown after cellarDisplayName
// wherever that appears, in the owner's own words, never manufactured
// when absent.
function cellarMotto(domaine) {
  return domaine?.motto || null;
}

// Where an invited Guest member browses and favorites - and, since the
// anonymous name-in-a-cookie link was retired (BACKLOG #51), only them.
// See resolveGuestView in lib/guest.js.
export default async function GuestPage({ searchParams }) {
  // With accounts switched off there is nobody to invite, so there is no
  // one this page is for. Said plainly rather than bounced, since the
  // owner is the only person who could land here and deserves the reason.
  if (!isAuthConfigured()) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Guest browsing needs an invite</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Guests are people invited to a cellar with their own sign-in, and
          accounts aren&apos;t switched on here yet — so there&apos;s nobody
          this page can show a cellar to.
        </p>
      </div>
    );
  }

  const view = await resolveGuestView();
  if (!view) {
    // Signed out: the way in is signing in. A Cellarmaster: the whole
    // app is theirs, and the owner pages are where it is.
    const session = await auth();
    redirect(session?.user?.id ? "/" : "/signin");
  }
  const { domaineId, guest } = view;

  // "Who will see your favorites" has to name an actual person. "The
  // owner" named here is the Domaine's founding Cellarmaster - the person
  // a guest most likely knows it by.
  const domaine = await prisma.domaine.findUnique({
    where: { id: domaineId },
    select: {
      name: true,
      motto: true,
      members: {
        where: { role: "cellarmaster" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { name: true, email: true },
      },
    },
  });
  const owner = domaine?.members[0];
  const ownerName = ownerDisplayName(owner);
  const cellarName = cellarDisplayName(domaine, owner);
  const motto = cellarMotto(domaine);

  // lib/scoped-prisma.js is for Cellarmasters, so this page scopes itself,
  // by the Domaine resolveGuestView settled on above.
  const [rows, regionOptions, filters] = await Promise.all([
    prisma.bottle.findMany({
      where: { status: "inventory", domaineId },
      include: { favorites: { where: { guestId: guest.id }, select: { id: true } } },
      orderBy: { producer: "asc" },
    }),
    getRegionOptions(domaineId),
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
        {/* The only way out a Guest has, since the owner pages send them
            straight back here. */}
        <form action={signOutOfCellar}>
          <button type="submit" className="text-xs text-zinc-500 underline underline-offset-2">
            Sign out
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
