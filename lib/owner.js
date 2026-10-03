import "server-only";
import { prisma } from "@/lib/prisma";
import { auth, isAuthConfigured } from "@/lib/auth";

// Who is asking, and on behalf of which Domaine:
// { id, domaineId, role, email, isAppOwner }.
//
// Phase 0 of separate cellars built currentOwnerId as the single seam
// between a one-owner app and a multi-user one; Phase 1 of Shared cellars
// widens that seam from "which person" to "which person, in which
// Domaine, allowed to do what" - because the cellar now belongs to the
// Domaine, and a person's User id alone no longer says whose bottles
// they're looking at.
//
// Signed in, all three come off the session, which lib/auth.js's session
// callback fills from the User row Auth.js has just read anyway (database
// sessions re-read it on every request) - so a role or Domaine change
// takes effect on the very next request, with no second query here.
//
// Still not cached, and now the reason is not just tidiness. A
// module-scope cache here would serve one person's identity into another
// person's request - the single worst bug this plan could produce, and one
// that would look like data appearing in the wrong cellar rather than like
// a caching bug. There is nothing to gain that is worth being near that.
export async function currentMember() {
  if (isAuthConfigured()) {
    const session = await auth();
    const user = session?.user;

    // No session is not a fallback to the owner - it is a bug or an
    // attack, and the only safe answer is to write nothing. Every caller
    // is a mutation or a cellar read, and the pages that reach them are
    // behind the guard in app/(owner)/layout.js, so arriving here signed
    // out means something upstream failed open.
    if (!user?.id || !user.domaineId || !user.role) throw new Error("Not signed in.");
    return {
      id: user.id,
      domaineId: user.domaineId,
      role: user.role,
      email: user.email ?? null,
      isAppOwner: user.isAppOwner === true,
    };
  }

  // Unconfigured: exactly the Phase 0 behaviour, because until the owner
  // sets the auth variables this app is still the single-owner app it has
  // always been. See isAuthConfigured in lib/auth.js for why that is a
  // deliberate state and not a gap.
  const owner = await earliestUser();
  return {
    id: owner.id,
    domaineId: owner.domaineId,
    role: owner.role,
    email: owner.email,
    isAppOwner: owner.isAppOwner === true,
  };
}

// currentMember, refused for anyone who isn't a Cellarmaster. What every
// owner-side read and write goes through (lib/scoped-prisma.js calls it
// for every scoped query), so a guest-role member is turned away by the
// cellar's data layer itself, not only by the layout redirect that
// normally keeps them from ever reaching an owner page. A Server Action
// is its own endpoint and never renders that layout.
export async function currentCellarmaster() {
  const member = await currentMember();
  if (member.role !== "cellarmaster") {
    throw new Error("Guests can browse this cellar, but not change it.");
  }
  return member;
}

// Who is adding the row being written - attribution only since the
// cellar moved to belonging to a Domaine (see Bottle.ownerId). Kept as its
// own function because every create site already calls it.
export async function currentOwnerId() {
  return (await currentCellarmaster()).id;
}

// The Domaine whose cellar this request reads and writes.
export async function currentDomaineId() {
  return (await currentCellarmaster()).domaineId;
}

// Whether this person runs the app itself, as opposed to one cellar in it:
// the one who pays for the API key, and so the only one who may see every
// Domaine's AI spend and set its limits (/usage). A Domaine's own
// Cellarmasters can't - they'd be raising their own limit on someone
// else's bill.
//
// Stored on the account (User.isAppOwner), not worked out here. It used to
// be "any Cellarmaster of the earliest account's Domaine", which made
// everyone ever added to that Domaine an operator, and would have handed
// the role to the next-oldest account - in a different Domaine, perhaps -
// the day the earliest one was removed. Before accounts are switched on
// the one account is flagged, so the single-owner app is its own operator.
export async function isAppOwner() {
  try {
    return (await currentCellarmaster()).isAppOwner === true;
  } catch {
    return false;
  }
}

async function earliestUser() {
  // Tiebroken by id, as the migrations are: two accounts can share a
  // createdAt, and "the earliest" must name the same one everywhere.
  const owner = await prisma.user.findFirst({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (!owner) {
    throw new Error(
      "No owner row found. The 20260921170000_add_owner migration seeds one - run `prisma migrate deploy`."
    );
  }
  return owner;
}

// The signed-in person, or null when nobody is - for rendering rather than
// for writing. Never throws, because a header that wants to show a name is
// not a reason to fail a page.
export async function currentUser() {
  if (!isAuthConfigured()) return null;
  const session = await auth();
  return session?.user ?? null;
}
