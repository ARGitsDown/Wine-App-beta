import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const GUEST_COOKIE = "guestId";

// Reads the guest identity (if any) for the current browser, from the
// cookie set by entering a name at /guest. Shared between the guest page
// (to render as that guest) and the favorite-toggling action.
export async function getCurrentGuest() {
  const cookieStore = await cookies();
  const guestId = Number(cookieStore.get(GUEST_COOKIE)?.value);
  if (!Number.isInteger(guestId)) return null;
  return prisma.guest.findUnique({ where: { id: guestId } });
}
