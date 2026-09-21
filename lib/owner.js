import "server-only";
import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";

// Who the row being written belongs to.
//
// Phase 0 built this as the single seam between a one-owner app and a
// multi-user one, and Phase 1 is the change it existed for: everything
// below the first branch is what it always did, and the branch is the
// whole of "the app knows who you are now". Every create site already
// calls it, so nothing else had to move.
//
// Still not cached, and now the reason is not just tidiness. A
// module-scope cache here would serve one person's identity into another
// person's request - the single worst bug this plan could produce, and one
// that would look like data appearing in the wrong cellar rather than like
// a caching bug. There is nothing to gain that is worth being near that.
export async function currentOwnerId() {
  if (isAuthConfigured()) {
    const session = await auth();
    const id = session?.user?.id;

    // No session is not a fallback to the owner - it is a bug or an
    // attack, and the only safe answer is to write nothing. Every caller
    // is a mutation, and the pages that reach them are behind the guard in
    // app/(owner)/layout.js, so arriving here signed out means something
    // upstream failed open.
    if (!id) throw new Error("Not signed in.");
    return id;
  }

  // Unconfigured: exactly the Phase 0 behaviour, because until the owner
  // sets the auth variables this app is still the single-owner app it has
  // always been. See isAuthConfigured in lib/auth.js for why that is a
  // deliberate state and not a gap.
  const owner = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!owner) {
    throw new Error(
      "No owner row found. The 20260921170000_add_owner migration seeds one - run `prisma migrate deploy`."
    );
  }
  return owner.id;
}

// The signed-in person, or null when nobody is - for rendering rather than
// for writing. Never throws, because a header that wants to show a name is
// not a reason to fail a page.
export async function currentUser() {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  return session?.user ?? null;
}
