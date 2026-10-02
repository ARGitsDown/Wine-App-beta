// What an invite can grant - Invite.access in prisma/schema.prisma - in
// one list shared by the form that picks it, the action that checks it,
// and the page that shows what each invite gave. Plain data with no
// imports, so the client-side InviteForm can use it.
//
// Ordered as the form lists them: the two that share this cellar first,
// most access first, and the one that doesn't share at all last.
export const INVITE_ACCESS_OPTIONS = [
  {
    value: "cellarmaster",
    label: "Cellarmaster",
    description: "Shares this cellar with full access - add, edit, scan, Suggest.",
  },
  {
    value: "guest",
    label: "Guest",
    description: "Browses this cellar and favorites bottles. Can't change anything.",
  },
  {
    value: "separate",
    label: "A separate cellar of their own",
    description: "A new, empty cellar just for them. They see nothing of yours.",
  },
];

// The options that share *this* cellar, and the one that doesn't. Kept
// apart on the form (BACKLOG #53): "a separate cellar" isn't an answer to
// "what can they do in yours?", so it sits below a divider of its own
// rather than as a third peer of Cellarmaster and Guest.
export const SHARING_OPTIONS = INVITE_ACCESS_OPTIONS.filter((option) => option.value !== "separate");
export const SEPARATE_OPTION = INVITE_ACCESS_OPTIONS.find((option) => option.value === "separate");

export const INVITE_ACCESS_VALUES = new Set(INVITE_ACCESS_OPTIONS.map((option) => option.value));

export function inviteAccessLabel(value) {
  return INVITE_ACCESS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
