import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// A full JSON backup of everything in the database - cheap peace of mind
// for a personal system with no other backup story. Not paginated or
// filtered: a personal cellar is small enough that the whole thing fits in
// one response.
export async function GET() {
  const [bottles, guests] = await Promise.all([
    prisma.bottle.findMany({
      include: { tastingNotes: true },
      orderBy: { id: "asc" },
    }),
    prisma.guest.findMany({
      include: { favorites: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    bottles,
    guests,
  };

  const filename = `wine-cellar-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
