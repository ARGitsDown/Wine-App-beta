import {
  CellarIcon,
  WishlistIcon,
  TastingHistoryIcon,
  FlightsIcon,
} from "@/app/components/icons";

// One place for how each Bottle.status looks and reads, wherever it needs
// to be more than plain text. Research's two lists and the bottle page
// used to just print `{bottle.status}` - meanwhile the home cards and
// Scan's own destination picker each already carry the same icon+accent
// pairing, independently. BACKLOG #17: "Research, the scan cards and the
// bottle page [should] speak the same visual language from one source
// rather than three [guessing at it separately]." This is that source;
// see StatusBadge.js for the small pill built from it.
export const STATUS_LOOK = {
  inventory: {
    label: "Cellar",
    Icon: CellarIcon,
    accent: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  },
  wishlist: {
    label: "Wishlist",
    Icon: WishlistIcon,
    accent: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  consumed: {
    label: "Tasted",
    Icon: TastingHistoryIcon,
    accent: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
  },
  flight: {
    label: "Flight",
    Icon: FlightsIcon,
    accent: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  },
};
