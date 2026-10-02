"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAppOwner } from "@/lib/owner";

// Dollars typed into a form -> whole cents, or null for blank ("no limit
// of this kind"), or undefined for something that isn't a usable amount.
// Capped at $10,000 a month: not a policy, just a guard against a stray
// extra zero becoming "effectively unlimited" without anyone choosing it.
const MAX_CENTS = 1_000_000;

function centsFromDollars(raw) {
  const text = String(raw ?? "").trim().replace(/^\$/, "");
  if (text === "") return null;
  const dollars = Number(text);
  if (!Number.isFinite(dollars) || dollars < 0) return undefined;
  const cents = Math.round(dollars * 100);
  return cents > MAX_CENTS ? undefined : cents;
}

// Sets one Domaine's monthly AI cap and hard stop. Only the app owner may:
// every Domaine's Cellarmasters can reach a Server Action by name, so the
// check is made here, not left to the page that happens to hide the form -
// otherwise anyone could raise their own limit on the owner's bill.
export async function setDomaineLimits(domaineId, prevState, formData) {
  // Handed back with every refusal. React clears an uncontrolled form back
  // to its default values once an action finishes, so without this a
  // refused save wiped what had just been typed - and a typo in one field
  // cost the other.
  const typed = { cap: String(formData.get("cap") ?? ""), hardStop: String(formData.get("hardStop") ?? "") };

  if (!(await isAppOwner())) {
    return { error: "Only whoever runs this app can change usage limits.", typed };
  }

  const cap = centsFromDollars(formData.get("cap"));
  const hardStop = centsFromDollars(formData.get("hardStop"));
  if (cap === undefined || hardStop === undefined) {
    return { error: "Use a dollar amount like 5 or 5.50, or leave it blank for no limit.", typed };
  }
  if (cap != null && hardStop != null && hardStop < cap) {
    return {
      error: "The hard stop can't be lower than the monthly cap - it's the point where AI pauses, after the cap's lighter models.",
      typed,
    };
  }

  // updateMany rather than update: an id that isn't a Domaine is "nothing
  // changed", not a crash with a stack trace for whoever mistyped it.
  const { count } = await prisma.domaine.updateMany({
    where: { id: String(domaineId) },
    data: { monthlySpendCapCents: cap, monthlyHardStopCents: hardStop },
  });
  if (count === 0) return { error: "That Domaine no longer exists.", typed };

  revalidatePath("/usage");
  revalidatePath("/invites");
  return { success: true };
}
