// What an invite can grant - Invite.access in prisma/schema.prisma - in
// one list shared by the form that picks it, the action that checks it,
// and the page that shows what each invite gave. Plain data with no
// heavy imports (just lib/roles.js), so the client-side InviteForm can use it.
//
import { ACCESS, ACCESS_VALUES } from "./roles.js";

// Ordered as the form lists them: the two that share this cellar first,
// most access first, and the one that doesn't share at all last.
export const INVITE_ACCESS_OPTIONS = [
  {
    value: ACCESS.CELLARMASTER,
    label: "Cellarmaster",
    description: "Shares this cellar with full access - add, edit, scan, Suggest.",
  },
  {
    value: ACCESS.GUEST,
    label: "Guest",
    description: "Browses this cellar and favorites bottles. Can't change anything.",
  },
  {
    value: ACCESS.SEPARATE,
    label: "A separate cellar of their own",
    description: "A new, empty cellar just for them. They see nothing of yours.",
  },
];

// The options that share *this* cellar, and the one that doesn't. Kept
// apart on the form (BACKLOG #53): "a separate cellar" isn't an answer to
// "what can they do in yours?", so it sits below a divider of its own
// rather than as a third peer of Cellarmaster and Guest.
export const SHARING_OPTIONS = INVITE_ACCESS_OPTIONS.filter((option) => option.value !== ACCESS.SEPARATE);
export const SEPARATE_OPTION = INVITE_ACCESS_OPTIONS.find((option) => option.value === ACCESS.SEPARATE);

export const INVITE_ACCESS_VALUES = ACCESS_VALUES;

export function inviteAccessLabel(value) {
  return INVITE_ACCESS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
