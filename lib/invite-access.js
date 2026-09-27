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
    label: "Their own Domaine",
    description: "Gets a new, empty cellar of their own. Sees nothing of yours.",
  },
];

export const INVITE_ACCESS_VALUES = new Set(INVITE_ACCESS_OPTIONS.map((option) => option.value));

export function inviteAccessLabel(value) {
  return INVITE_ACCESS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
