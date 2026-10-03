// The words a User's role and an Invite's access are stored as - User.role
// and Invite.access in prisma/schema.prisma - in one place, the way
// WINE_COLORS is for wine colors. They were string literals in about
// twenty files, and a typo in one of them ("cellarmaster" vs
// "cellarmasters") fails silently: a comparison that is simply never true,
// which for `role !== "cellarmaster"` means locking someone out, and for
// `role === "cellarmaster"` means quietly not finding them.
//
// Plain data with no imports, so client components (InviteForm) and plain
// node scripts can both load it. The stored values never change - they are
// in the database - only the code spells them from here.

// What a member of a Domaine can be. User.role holds exactly one of these.
export const ROLE = Object.freeze({
  CELLARMASTER: "cellarmaster", // full access: add, edit, scan, delete, Suggest, Research
  GUEST: "guest", // browse and favorite, no editing
});
export const ROLE_VALUES = new Set(Object.values(ROLE));

// What an invite can grant: either of the roles (the person joins the
// inviting Domaine as that), or a cellar of their own (a new Domaine, in
// which they are its Cellarmaster - see createUser in lib/auth.js).
// Invite.access holds exactly one of these.
export const ACCESS = Object.freeze({
  ...ROLE,
  SEPARATE: "separate",
});
export const ACCESS_VALUES = new Set(Object.values(ACCESS));
