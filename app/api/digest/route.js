import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { buildDigest, isDigestDue } from "@/lib/digest";
import { ROLE } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

// Where "Open your cellar" points: an explicit URL if one is set, else the
// production host Vercel provides. Null when neither is known - the email just
// has no link.
function appUrl() {
  const explicit = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : null;
}

// Hit once a day by Vercel Cron (vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. There is no session here, so this is
// the one place the plain client is used for cellar data with the Domaine
// named by hand (never the scoped client, which needs a signed-in member), and
// the secret is the whole door: without CRON_SECRET set the route refuses
// everything rather than running open.
//
// For each person who opted in (User.digestFrequency) and is due
// (lib/digest.js), the send is *claimed* first with a conditional UPDATE on
// digestLastSentAt - set only if it still holds the value that was read - so
// two overlapping runs cannot both send. If there is nothing to say, or the
// send fails, the old value is put back so the next run looks again.
export async function GET(request) {
  const ok = authorized(request);
  if (ok === null) {
    return Response.json({ error: "The digest is not set up (CRON_SECRET)." }, { status: 503 });
  }
  if (!ok) return Response.json({ error: "Not allowed." }, { status: 401 });
  if (!isEmailConfigured()) {
    return Response.json({ sent: 0, skipped: "Email is not configured." });
  }

  const now = new Date();
  const people = await prisma.user.findMany({
    where: { digestFrequency: { not: null }, role: ROLE.CELLARMASTER, email: { not: null } },
    select: { id: true, email: true, domaineId: true, digestFrequency: true, digestLastSentAt: true },
  });

  let sent = 0;
  let failed = 0;
  for (const person of people) {
    if (!isDigestDue(person, now)) continue;

    const claimed = await prisma.user.updateMany({
      where: { id: person.id, digestLastSentAt: person.digestLastSentAt },
      data: { digestLastSentAt: now },
    });
    if (claimed.count === 0) continue;

    const release = () =>
      prisma.user.updateMany({
        where: { id: person.id, digestLastSentAt: now },
        data: { digestLastSentAt: person.digestLastSentAt },
      });

    try {
      const bottles = await prisma.bottle.findMany({
        where: { domaineId: person.domaineId, status: "inventory" },
        select: {
          producer: true,
          bottling: true,
          vintage: true,
          quantity: true,
          drinkFrom: true,
          drinkTo: true,
          drinkWindowEstimated: true,
        },
      });
      const digest = buildDigest(bottles, { year: now.getFullYear(), appUrl: appUrl() });
      if (!digest) {
        await release();
        continue;
      }
      await sendEmail({ to: person.email, ...digest });
      sent += 1;
    } catch (err) {
      console.error("Digest send failed:", err);
      failed += 1;
      await release();
    }
  }
  return Response.json({ sent, failed });
}
