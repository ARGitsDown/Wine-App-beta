"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { REGION_OPTIONS_TAG } from "@/lib/bottles";
import { anthropic, EXTRACTION_MODEL, REASONING_MODEL } from "@/lib/anthropic";
import { DEFAULT_EFFORT, normalizeEffort, outputConfig } from "@/lib/effort";
import { normalizeCharacter } from "@/lib/suggestion-character";
import {
  wineLabelForBottle,
  wineLabelForGap,
  wineNameForBottle,
  wineNameForGap,
} from "@/lib/pairings";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { GUEST_COOKIE, getCurrentGuest } from "@/lib/guest";
import { canonicalizeVarietal } from "@/lib/varietal-match";
import { drinkWindowCacheKey } from "@/lib/drink-window-cache";
import { characterRule } from "@/lib/suggestion-character";
import { RESEARCH_FIELDS, researchChanges } from "@/lib/research-fields";
import { parseTastedDate } from "@/lib/tasting-date";
import { acquiredAtForStatus, emptiedAtForStatus } from "@/lib/bottle-dates";
import { DEFAULT_SCAN_INTENT, statusForScanIntent } from "@/lib/scan-intent";
import { WINE_COLORS } from "@/lib/wine-colors";
import { uploadLabelPhoto } from "@/lib/blob";

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalFloat(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseOptionalRating(value) {
  const n = parseOptionalInt(value);
  return n !== null && n >= 1 && n <= 5 ? n : null;
}

function bottleDataFromForm(formData) {
  const type = String(formData.get("type") || "").trim() || null;
  const variety = String(formData.get("variety") || "").trim() || null;
  return {
    producer: String(formData.get("producer") || "").trim(),
    bottling: String(formData.get("bottling") || "").trim() || null,
    vintage: parseOptionalInt(formData.get("vintage")),
    type,
    variety,
    // Re-derived from type/variety on every save (not user-editable
    // directly) - see lib/varietal-match.js for why a blend or unrecognized
    // grape deliberately resolves to null instead of a guess.
    canonicalVariety: canonicalizeVarietal(type, variety),
    region: String(formData.get("region") || "").trim() || null,
    subRegion: String(formData.get("subRegion") || "").trim() || null,
    country: String(formData.get("country") || "").trim() || null,
    quantity: Math.max(1, parseOptionalInt(formData.get("quantity")) || 1),
    notes: String(formData.get("notes") || "").trim() || null,
    abv: parseOptionalFloat(formData.get("abv")),
    wineColor: WINE_COLORS.includes(formData.get("wineColor"))
      ? formData.get("wineColor")
      : null,
    drinkFrom: parseOptionalInt(formData.get("drinkFrom")),
    drinkTo: parseOptionalInt(formData.get("drinkTo")),
    criticNotes: String(formData.get("criticNotes") || "").trim() || null,
  };
}

// drinkWindowEstimated is only ever set true by an estimate-producing
// action (scan, Research's fallback, a bulk backfill, or a dedicated
// estimate action - see BACKLOG.md #7), never by a plain form save. If a
// save actually changes the window's years, clear it back to false - the
// human has made the call now - otherwise leave it untouched.
function clearEstimatedFlagIfWindowChanged(data, existingBottle) {
  if (!existingBottle) return data;
  const changed =
    existingBottle.drinkFrom !== data.drinkFrom || existingBottle.drinkTo !== data.drinkTo;
  return changed ? { ...data, drinkWindowEstimated: false } : data;
}

// A window only counts as estimated when there is one at all, and only
// counts as sourced when the research pass said so outright - an absent or
// malformed flag lands on "estimated", which is the honest default.
function windowEstimatedFromProposal(data, proposal) {
  if (data.drinkFrom == null && data.drinkTo == null) return false;
  return proposal?.proposed?.drinkWindowEstimated !== false;
}

// The Region autocomplete's list is cached (see getRegionOptions), and a
// bottle write is the only way a region name it hasn't seen can appear.
// Called after creating or editing a bottle, not after deleting one: a
// suggestion for a region you no longer own is harmless, and the cache's
// own revalidate clears it out eventually.
function invalidateRegionOptions() {
  revalidateTag(REGION_OPTIONS_TAG);
}

function pathForStatus(status) {
  if (status === "inventory") return "/inventory";
  if (status === "consumed") return "/consumed";
  return "/wishlist";
}

// Same shape as bottleDataFromForm, but reads directly from a wine object
// (one entry of the scan tool's own output) instead of a FormData - used
// when scan auto-saves each extracted wine immediately (see
// extractWinesFromPhoto) rather than waiting on a manual form submission.
function bottleDataFromWine(wine) {
  const type = wine.type || null;
  const variety = wine.variety || null;
  return {
    producer: wine.producer,
    bottling: wine.bottling || null,
    vintage: wine.vintage ?? null,
    type,
    variety,
    canonicalVariety: canonicalizeVarietal(type, variety),
    region: wine.region || null,
    subRegion: wine.subRegion || null,
    country: wine.country || null,
    quantity: 1,
    notes: null,
    abv: wine.abv ?? null,
    wineColor: WINE_COLORS.includes(wine.wineColor) ? wine.wineColor : null,
    drinkFrom: wine.drinkFrom ?? null,
    drinkTo: wine.drinkTo ?? null,
    // Only meaningful when there is a window at all, and only false when
    // the model says the source stated one outright - so an unanswered or
    // malformed flag lands on "estimated", which is the honest default.
    drinkWindowEstimated:
      (wine.drinkFrom ?? null) !== null || (wine.drinkTo ?? null) !== null
        ? wine.drinkWindowEstimated !== false
        : false,
    // Filled in at scan time only when the photo itself showed somebody
    // else's words about the wine; Research fills the same field later from
    // the web. The owner's own words go to a TastingNote instead - see the
    // save loop in extractWinesFromPhoto.
    criticNotes: wine.criticNotes || null,
  };
}

async function insertBottle(status, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return null;
  // Only set on creation (e.g. from the scan flow, when extraction wasn't
  // confident) - editing a bottle afterward never touches this flag one
  // way or the other, so only the research panel's own actions clear it.
  const needsResearch = formData.get("needsResearch") === "true";
  // Same reasoning: only ever set from the scan flow's hidden field at
  // creation time, never touched by a later manual edit.
  const photoUrl = String(formData.get("photoUrl") || "").trim() || null;
  try {
    const created = await prisma.bottle.create({
      // A wine logged straight into History was drunk at some point; "now"
      // is the same standing guess the tasting note's date makes, and is
      // correctable afterward.
      data: {
        ...data,
        status,
        needsResearch,
        photoUrl,
        emptiedAt: emptiedAtForStatus(status, null),
        acquiredAt: acquiredAtForStatus(status, null),
      },
    });
    invalidateRegionOptions();
    return created;
  } catch (err) {
    // The scan page can have several of these forms on screen at once, each
    // an independent submission - a transient DB error on one shouldn't
    // throw an unhandled error out of the Server Action, which would trip
    // Next.js's default error boundary and blow away every other card's
    // unsaved, not-yet-reviewed state along with it.
    console.error("Failed to save bottle:", err);
    return null;
  }
}

// The BottleForm components below all use useActionState, so these return
// { error } or { success: true } instead of silently doing nothing on
// failure - previously a whitespace-only producer or a swallowed DB error
// still made the form report "✓ Saved", since that indicator only watched
// for the form's pending state going true→false, not whether anything
// actually got written.
export async function createBottle(status, prevState, formData) {
  const bottle = await insertBottle(status, formData);
  if (!bottle) return { error: "Couldn't save that bottle - check the producer name and try again." };
  revalidatePath(pathForStatus(status));
  return { success: true };
}

// Used by the scan flow, where every card offers an optional tasting note
// alongside the usual bottle fields (e.g. a shop tasting sheet's own
// write-up, prefilled for the user to edit or add their own rating to).
export async function createBottleWithNote(status, prevState, formData) {
  const bottle = await insertBottle(status, formData);
  if (!bottle) return { error: "Couldn't save that bottle - check the producer name and try again." };

  const note = String(formData.get("note") || "").trim();
  if (note) {
    const rating = parseOptionalRating(formData.get("rating"));
    try {
      await prisma.tastingNote.create({ data: { bottleId: bottle.id, note, rating } });
    } catch (err) {
      // Same reasoning as insertBottle's catch: don't let one card's DB
      // hiccup take down the rest of the batch. The bottle itself is
      // already saved at this point; only the note is at risk here.
      console.error("Failed to save tasting note:", err);
    }
  }

  revalidatePath(pathForStatus(status));
  revalidatePath(`/bottles/${bottle.id}`);
  return { success: true };
}

export async function updateBottle(id, prevState, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return { error: "Producer is required." };

  try {
    const existing = await prisma.bottle.findUnique({
      where: { id },
      select: { drinkFrom: true, drinkTo: true },
    });
    const bottle = await prisma.bottle.update({
      where: { id },
      data: clearEstimatedFlagIfWindowChanged(data, existing),
    });
    invalidateRegionOptions();
    revalidatePath(`/bottles/${id}`);
    revalidatePath(pathForStatus(bottle.status));
    // The row comes back so a caller holding its own copy can refresh it.
    // The scan cards do: each leads with the wine's name and region, which
    // otherwise kept showing the pre-edit values after a successful save.
    return { success: true, bottle };
  } catch (err) {
    console.error("Failed to update bottle:", err);
    return { error: "Couldn't save those changes. Please try again." };
  }
}

// Says whether it worked, because the scan card moves its radio before
// waiting for the answer. Returning nothing meant a failed move - or a row
// already deleted, which used to return silently right here - left the card
// reading Wishlist while the database still said Cellar, with nothing on
// screen disagreeing. The caller puts the radio back on { error }.
export async function setBottleStatus(id, status) {
  try {
    const existing = await prisma.bottle.findUnique({
      where: { id },
      select: { emptiedAt: true, acquiredAt: true },
    });
    if (!existing) {
      return { error: "That wine is no longer in your cellar." };
    }

    await prisma.bottle.update({
      where: { id },
      data: {
        status,
        emptiedAt: emptiedAtForStatus(status, existing.emptiedAt),
        acquiredAt: acquiredAtForStatus(status, existing.acquiredAt),
      },
    });
    // A bottle can be noted long before it's marked drunk - the note is
    // the evening, the status change is the tidying up afterwards - so the
    // note's date wins over the "now" just stamped above.
    if (status === "consumed") await syncEmptiedToLatestNote(id);

    revalidatePath(`/bottles/${id}`);
    revalidatePath("/inventory");
    revalidatePath("/wishlist");
    revalidatePath("/consumed");
    return { ok: true };
  } catch (err) {
    console.error("Failed to change a bottle's status:", err);
    return { error: "Couldn't move that wine. Please try again." };
  }
}

// Correcting when a bottle was actually emptied, the same way a tasting
// note's date can be corrected - the button stamps "now", which is right
// when you log as you drink and wrong when you're catching up later.
// Emptied and tasted are the same evening on a bottle that's been drunk,
// so the newest tasting note's date is the date it was emptied. Keeping
// the two in step here is what lets the card stop showing both: emptiedAt
// is what History sorts by, and on its own it keeps whatever "now" was
// when the status was flipped - which a corrected note date then silently
// contradicted, leaving History in an order the dates on screen denied.
//
// Only for a bottle already in History. A note on a bottle still in the
// cellar is one of six bottles tasted, not the end of the wine.
async function syncEmptiedToLatestNote(bottleId) {
  const bottle = await prisma.bottle.findUnique({
    where: { id: bottleId },
    select: { status: true },
  });
  if (bottle?.status !== "consumed") return;

  const latest = await prisma.tastingNote.findFirst({
    where: { bottleId },
    orderBy: [{ tastedAt: "desc" }, { id: "desc" }],
    select: { tastedAt: true },
  });
  if (!latest) return;

  await prisma.bottle.update({
    where: { id: bottleId },
    data: { emptiedAt: latest.tastedAt },
  });
  revalidatePath("/consumed");
}

export async function updateEmptiedDate(id, formData) {
  const emptiedAt = parseTastedDate(formData.get("emptiedAt"));
  if (!emptiedAt) return { error: "That date doesn't look right." };

  try {
    await prisma.bottle.update({ where: { id }, data: { emptiedAt } });
    revalidatePath(`/bottles/${id}`);
    revalidatePath("/consumed");
    return { success: true };
  } catch (err) {
    console.error("Failed to update emptied date:", err);
    return { error: "Couldn't save that date. Please try again." };
  }
}

// Correcting when a bottle was actually acquired - the stamp is "today",
// which is right when you log a bottle as you buy it and wrong whenever
// you're entering a cellar you already owned.
//
// Unlike the emptied date this one clears on an empty submission. A wrong
// acquisition date is worse than none, and there's a legitimate way to end
// up with one: a wine mistakenly logged to the cellar and then corrected
// really does have no date to show.
export async function updateAcquiredDate(id, formData) {
  const raw = String(formData.get("acquiredAt") ?? "").trim();
  const acquiredAt = raw === "" ? null : parseTastedDate(raw);
  if (raw !== "" && !acquiredAt) return { error: "That date doesn't look right." };

  try {
    await prisma.bottle.update({ where: { id }, data: { acquiredAt } });
    revalidatePath(`/bottles/${id}`);
    revalidatePath("/inventory");
    revalidatePath("/consumed");
    return { success: true };
  } catch (err) {
    console.error("Failed to update acquired date:", err);
    return { error: "Couldn't save that date. Please try again." };
  }
}

// Tasting one bottle out of several you own. This used to go through
// setBottleStatus, which moved the whole row to History regardless of
// quantity - so opening one of a case of six both lost the five still in
// the cellar and made `quantity` stop meaning anything.
//
// A row is the wine, not an individual bottle, so it only leaves the cellar
// once the last one is gone: above one, this just decrements. The record of
// *when* each bottle was drunk lives in that wine's tasting notes, which
// carry their own dates and stay attached either way.
export async function markOneTasted(id) {
  const bottle = await prisma.bottle.findUnique({
    where: { id },
    select: { quantity: true, emptiedAt: true },
  });
  if (!bottle) return;

  const data =
    bottle.quantity > 1
      ? { quantity: bottle.quantity - 1 }
      : {
          status: "consumed",
          quantity: 1,
          emptiedAt: emptiedAtForStatus("consumed", bottle.emptiedAt),
        };

  await prisma.bottle.update({ where: { id }, data });
  revalidatePath(`/bottles/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/consumed");
}

// Correcting the count in place (bought two more, miscounted), as opposed
// to markOneTasted's "I drank one". Deliberately floors at 1: dropping to
// zero is the same thing as no longer owning any, which is what
// markOneTasted is for, and doing it here would strand a bottle in
// the cellar at quantity 0.
export async function adjustBottleQuantity(id, delta) {
  const bottle = await prisma.bottle.findUnique({
    where: { id },
    select: { quantity: true, status: true },
  });
  if (!bottle) return;

  const next = Math.max(1, bottle.quantity + delta);
  if (next === bottle.quantity) return;

  await prisma.bottle.update({ where: { id }, data: { quantity: next } });
  revalidatePath(`/bottles/${id}`);
  revalidatePath(pathForStatus(bottle.status));
}

export async function deleteBottle(id) {
  const bottle = await prisma.bottle.delete({ where: { id } });
  revalidatePath(pathForStatus(bottle.status));
  redirect(pathForStatus(bottle.status));
}

// Same delete as above, minus the redirect - for removing one card from a
// scan batch (where the user should stay on /scan reviewing whatever's
// left), not the bottle's own detail page (where navigating back to its
// list afterward makes sense).
//
// It reports rather than throws, as does removeScannedBottles below.
// Everything else on the scan path already caught; these two were the
// exceptions, so a transient database failure here threw out of the server
// action and took every unreviewed card on the page with it. The caller
// drops a card only once the row is actually gone, so the screen and the
// database cannot end up disagreeing.
export async function removeScannedBottle(id) {
  try {
    const bottle = await prisma.bottle.delete({ where: { id } });
    revalidatePath(pathForStatus(bottle.status));
    return { ok: true };
  } catch (err) {
    console.error("Failed to remove a scanned bottle:", err);
    return { error: "Couldn't delete that wine. Please try again." };
  }
}

// Dropping a whole photo from the scan batch deletes every bottle that photo
// saved, which can be several at once. Deliberately one action rather than a
// loop of removeScannedBottle on the client: each of those revalidates, and
// the router refresh that follows cancels the calls still in flight, so the
// last bottle or two survived a remove that said it had taken everything.
export async function removeScannedBottles(ids) {
  const wanted = (Array.isArray(ids) ? ids : [])
    .map(Number)
    .filter(Number.isInteger);
  if (wanted.length === 0) return { ok: true };

  try {
    // Read the statuses before deleting - afterwards there is nothing left to
    // say which lists need refreshing.
    const bottles = await prisma.bottle.findMany({
      where: { id: { in: wanted } },
      select: { status: true },
    });
    await prisma.bottle.deleteMany({ where: { id: { in: wanted } } });
    for (const path of new Set(bottles.map((b) => pathForStatus(b.status)))) {
      revalidatePath(path);
    }
    return { ok: true };
  } catch (err) {
    console.error("Failed to remove scanned bottles:", err);
    return { error: "Couldn't delete those wines. Please try again." };
  }
}

export async function addTastingNote(bottleId, formData) {
  const note = String(formData.get("note") || "").trim();
  if (!note) return;
  const rating = parseOptionalRating(formData.get("rating"));
  // Falls back to the column's own now() when the field is missing or
  // unparseable, so a note is never lost to a bad date.
  const tastedAt = parseTastedDate(formData.get("tastedAt")) ?? undefined;

  await prisma.tastingNote.create({ data: { bottleId, note, rating, tastedAt } });
  await syncEmptiedToLatestNote(bottleId);
  revalidatePath(`/bottles/${bottleId}`);
}

// Correcting when a note happened, without reopening the note itself -
// the date is the part you're most likely to get wrong, since until now it
// was always stamped with whenever you happened to write the note down.
export async function updateTastingNoteDate(noteId, formData) {
  const tastedAt = parseTastedDate(formData.get("tastedAt"));
  if (!tastedAt) return { error: "That date doesn't look right." };

  try {
    const note = await prisma.tastingNote.update({
      where: { id: noteId },
      data: { tastedAt },
      select: { bottleId: true },
    });
    await syncEmptiedToLatestNote(note.bottleId);
    revalidatePath(`/bottles/${note.bottleId}`);
    return { success: true };
  } catch (err) {
    console.error("Failed to update tasting note date:", err);
    return { error: "Couldn't save that date. Please try again." };
  }
}

const SEARCH_CELLAR_TOOL = {
  name: "search_cellar",
  description:
    "Search this user's own already-saved bottles by producer name, region, or country. Use this to check whether the same or a similar wine was logged before with fuller details than the current photo shows - e.g. a producer whose label doesn't print its grape variety, but whose variety is already known from an earlier bottle.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Producer name, region, or country to search for.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const WINE_ENTRY_SCHEMA = {
  type: "object",
  properties: {
    producer: {
      type: "string",
      description: "The producer/winery name as printed.",
    },
    bottling: {
      type: ["string", "null"],
      description:
        "The specific bottling, if this producer is known to make more than one wine from the same grape/vintage - a vineyard designation (e.g. 'Rochioli Vineyard', 'Kanzler Vineyard') or a proprietary/cuvée name (e.g. 'Madeleine', 'Reserve', 'Insignia'). This is what a producer prints to distinguish this specific wine from their other bottlings of the same variety. Fill this in only from text actually visible in the photo, including a name that is partial, small or half-cropped - knowing a producer's lineup is for *recognising* what you can partly see, never for choosing on its behalf. If you believe this producer makes several bottlings but cannot see which one this is, leave this null and set `confident` to false; naming the wrong one invents a bottle the owner does not own. Null also when this producer only makes one bottling of this grape, or there's no such distinguishing name.",
    },
    vintage: {
      type: ["integer", "null"],
      description: "The vintage year, or null if non-vintage/not visible.",
    },
    type: {
      type: ["string", "null"],
      description:
        "A SHORT, header-friendly style label - a few words at most, for at-a-glance browsing in a list. Most often just the grape variety (e.g. 'Zinfandel', 'Sauvignon Blanc'). For a blend or a wine with no single named variety, a concise style descriptor instead (e.g. 'Red Bordeaux Blend', 'White Rhône Blend', 'Orange Wine'). Keep any inference reasoning out of this field - put the fuller explanation in `variety` below instead.",
    },
    variety: {
      type: ["string", "null"],
      description:
        "The fuller, more detailed grape variety/blend description - this can be longer and more explanatory than `type` above. Many Old World wines (red/white Bordeaux, red/white Burgundy, Chianti, Barolo, Rioja, etc.) are identified only by region, not the grape - in that case, infer the conventional grape(s) for that appellation from your knowledge (e.g. red Bordeaux -> a Cabernet Sauvignon/Merlot blend, red Burgundy -> Pinot Noir, white Burgundy -> Chardonnay, Barolo -> Nebbiolo) and prefix the value with 'Likely ' since it wasn't stated outright. Null only if you have no reasonable basis to infer it.",
    },
    region: {
      type: ["string", "null"],
      description:
        "The primary sub-country identifier: for a US wine, the state (e.g. 'California', 'Oregon'); for anywhere else, the named wine region (e.g. 'Bordeaux', 'Burgundy', 'Central Otago', 'Burgenland'). Use your knowledge to fill this in even when only a narrower appellation is stated (e.g. 'Margaux' implies the region 'Bordeaux' - put the finer detail in `subRegion` instead, not here). Do not include the country here - that's a separate field.",
    },
    subRegion: {
      type: ["string", "null"],
      description:
        "A finer-grained locator within `region`, if the label states or implies one more specific than the broad region (e.g. 'Margaux' or 'Pauillac' within Bordeaux; 'Gevrey-Chambertin' within Burgundy; 'Russian River Valley' within California). Null if only the broad region is known/stated.",
    },
    country: {
      type: ["string", "null"],
      description:
        "Country of origin, inferred from your knowledge when not stated outright (e.g. a Margaux wine implies France).",
    },
    abv: {
      type: ["number", "null"],
      description:
        "Alcohol by volume as printed on the label, e.g. 14.5 for '14.5% ALC/VOL'. Null if not visible/stated.",
    },
    wineColor: {
      type: ["string", "null"],
      description:
        `One of ${WINE_COLORS.join(", ")} (exactly this spelling/casing) - the wine's color/category from label cues and your own judgment, not the same as \`type\` above (which names the grape/style). Sparkling/Dessert/Fortified take priority over the base color when they apply (e.g. a sparkling rosé is 'Sparkling', a Port is 'Fortified' even though it's red). Null only if you genuinely can't tell.`,
    },
    drinkFrom: {
      type: ["integer", "null"],
      description:
        "Start of the drinking window (a year). Always give your best estimate from the wine's style, structure, region and vintage - not only when the label states one. A rough window the owner can correct is worth far more to them than a blank field. Null only when you genuinely cannot judge, e.g. the producer or vintage was unreadable.",
    },
    drinkTo: {
      type: ["integer", "null"],
      description: "End of the drinking window (a year), same standard as drinkFrom.",
    },
    drinkWindowEstimated: {
      type: "boolean",
      description:
        "True when the window above is your own judgment; false only when the label or source document states it outright. Nearly always true - very few labels print a drinking window - and the app shows an 'estimated' marker either way, so answer honestly rather than generously.",
    },
    note: {
      type: ["string", "null"],
      description:
        "The OWNER'S OWN impression of this wine, and only that - handwriting on a tasting sheet, a scribbled card, a note they wrote themselves. This becomes their personal tasting note and counts as a wine they have tasted, so printed text from a shop, a winery or a critic never belongs here; that goes in `criticNotes` instead. Null unless the photo genuinely shows something the owner wrote - never invent one.",
    },
    criticNotes: {
      type: ["string", "null"],
      description:
        "Descriptive or tasting-note text printed by somebody else and visible in the photo - a shop's shelf talker or tasting sheet, a menu write-up, a back label, a critic's blurb quoted on the bottle. That text, lightly cleaned up but not rewritten or embellished, attributed where the source is clear (e.g. 'Shelf talker: ...'). Null for a plain label with no such text - never invent one.",
    },
    confident: {
      type: "boolean",
      description:
        "True only if you're confident in every field above, including any inferred ones. False if you had to guess at something uncertain - the user will double check fields when this is false.",
    },
  },
  required: [
    "producer",
    "bottling",
    "vintage",
    "type",
    "variety",
    "region",
    "subRegion",
    "country",
    "abv",
    "wineColor",
    "drinkFrom",
    "drinkTo",
    "note",
    "criticNotes",
    "confident",
  ],
  additionalProperties: false,
};

const WINES_TOOL = {
  name: "record_wines",
  description:
    "Record every distinct wine found in the photo, after reading it and doing any research needed. A photo is usually a single bottle label (one entry), but may instead be a document listing several wines - a shop's tasting sheet, a menu, a price list - in which case record one entry per wine.",
  input_schema: {
    type: "object",
    properties: {
      wines: {
        type: "array",
        description: "One entry per distinct wine found in the photo.",
        items: WINE_ENTRY_SCHEMA,
      },
    },
    required: ["wines"],
    additionalProperties: false,
  },
  strict: true,
};

async function searchCellar(query) {
  const q = String(query || "").trim();
  if (!q) return [];
  return prisma.bottle.findMany({
    where: {
      OR: [
        { producer: { contains: q, mode: "insensitive" } },
        { bottling: { contains: q, mode: "insensitive" } },
        { region: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      producer: true,
      bottling: true,
      vintage: true,
      type: true,
      variety: true,
      region: true,
      country: true,
    },
    take: 5,
  });
}

// A Claude call can come back 200-OK with no usable answer, and neither
// case throws, so neither is caught by the typed error handling below:
//
// - "refusal" - the safety classifiers declined the request. stop_details
//   says which category, and is null for every other stop reason, so it is
//   only ever read here.
// - "max_tokens" - the answer ran out of room part-way through. Adaptive
//   thinking spends the same budget, so a crowded photo costs far more of
//   it than a single label does.
//
// Both matter most *before* the tool-call lookup. strict:true guarantees a
// completed tool call validates, but says nothing about one cut off
// mid-array: a nine-wine tasting sheet truncated at six looks exactly like
// a six-wine sheet, and the app has no expected count to notice otherwise.
// Checking here means a truncated answer is never read as a whole one.
//
// Returns null when the response is usable, so callers read:
//   const unusable = unusableResponseError(response, {...});
//   if (unusable) return unusable;
function unusableResponseError(response, messages) {
  if (response.stop_reason === "refusal") {
    console.error("Claude declined the request:", response.stop_details);
    return { error: messages.refused };
  }
  if (response.stop_reason === "max_tokens") {
    return { error: messages.truncated };
  }
  return null;
}

const LABEL_SYSTEM_PROMPT =
  "You read wine photos for a personal cellar-tracking app. A photo is usually a single bottle label, but may instead be a document listing several wines - a shop's tasting sheet, a menu, a price list - in which case treat each distinct wine as its own entry. Extract what's stated, and use your wine knowledge to fill in what's implied but not stated outright (grape variety from an appellation's convention, broader geography from a narrow appellation). Many producers make several distinct wines from the same grape and vintage - a regional/estate bottling plus one or more vineyard-designated or proprietary-named bottlings (e.g. a producer's basic Pinot Noir alongside a 'Rochioli Vineyard' or a 'Madeleine' bottling). Think about whether this producer is one of those before settling on the `bottling` field - a label that only shows a small or partial vineyard/cuvée name (easy to crop out of a photo, or in small print) is exactly the kind of detail worth getting right, since it's what tells two of a producer's own bottlings apart - but only when you can actually see some of it. If the lineup makes you suspect a bottling name that is nowhere in the photo, leave `bottling` null and set `confident` to false rather than picking the producer's best-known one. If the photo includes descriptive or tasting-note-style text for a wine, mind whose words they are: anything printed by a shop, a winery or a critic (a shelf talker, a tasting-sheet write-up, a back label) goes in `criticNotes`, while `note` is only for something the owner wrote themselves, since that becomes their personal tasting note and marks the wine as one they have tasted. Never invent either for a plain label with no such text. You may call search_cellar first to check whether this user already logged a given producer/region with fuller details - use that as a grounding signal, not a guarantee, since it's the user's own inventory, not a verified reference. Call record_wines exactly once, when you're done with every wine in the photo, with your best final answer.";

// Reads a photo - one bottle label, or a document listing several wines -
// optionally researching the user's own saved bottles and the model's wine
// knowledge along the way, and saves each wine found as a real bottle
// right away (see the save loop below for why), returning the saved
// records for the scan flow to show as editable review cards. Each
// result is either { bottle } on success, or { wine, saveError: true } if
// reading succeeded but that one wine's save didn't.
export async function extractWinesFromPhoto(base64Image, mediaType, intent = DEFAULT_SCAN_INTENT) {
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Image },
        },
        {
          type: "text",
          text: "Read this photo and record every distinct wine in it.",
          // Caches everything before this point - both tool schemas, the
          // system prompt, and the photo - so the search_cellar turns that
          // follow reread it instead of resending it. The loop only ever
          // pushes onto messages, so messages[0] stays byte-identical
          // across turns, which is what makes this safe.
          cache_control: { type: "ephemeral" },
        },
      ],
    },
  ];

  try {
    // Bounded to a few turns: normally some search_cellar calls (if any,
    // possibly several in parallel for a multi-wine photo) then
    // record_wines, but this caps it in case the model keeps searching.
    for (let turn = 0; turn < 6; turn++) {
      const response = await anthropic.messages.create({
        model: EXTRACTION_MODEL,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        // Not the owner's choice to make here: a scan runs unattended
        // across a batch of photos, and a producer read wrong is a wrong
        // bottle saved to the cellar rather than a slower answer.
        output_config: outputConfig(DEFAULT_EFFORT),
        system: LABEL_SYSTEM_PROMPT,
        tools: [SEARCH_CELLAR_TOOL, WINES_TOOL],
        messages,
      });

      const unusable = unusableResponseError(response, {
        refused:
          "Claude declined to read that photo. Nothing was saved — if it's a wine label, try another shot; otherwise add the details by hand.",
        truncated:
          "That photo had more on it than one read could finish, so some wines would have been missed. Nothing was saved — try photographing fewer wines at a time, or one label per shot.",
      });
      if (unusable) return unusable;

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      const finalCall = toolUses.find((t) => t.name === "record_wines");
      if (finalCall) {
        if (finalCall.input.wines.length === 0) {
          return { error: "Couldn't find any wines in that photo. Try a clearer, well-lit photo." };
        }
        // One photo can hold several wines (a tasting sheet) - they all
        // share the same uploaded photo. Never blocks extraction: null
        // (unconfigured storage, a failed upload) just means no photo.
        const { url: photoUrl } = await uploadLabelPhoto(base64Image, mediaType);

        // Each wine is saved immediately rather than held only in the
        // browser's memory pending a manual "Save" click - clicking away
        // (or the tab closing) mid-review used to silently discard a
        // completed scan, since the bottle didn't exist anywhere until
        // that click. By the time this action returns, every bottle
        // below is already in the database - still fully editable
        // afterward, and still flagged needsResearch when Claude wasn't
        // confident, exactly as before; only the timing of the save
        // moved earlier. A per-wine save failure (rare - a DB hiccup)
        // doesn't lose the rest of the batch's otherwise-successful
        // saves; that one wine falls back to the same unsaved-draft card
        // used when reading a photo fails outright.
        const results = [];
        for (const wine of finalCall.input.wines) {
          // The batch's intent decides where a wine lands. This used to be
          // inferred from whether the source document carried tasting text,
          // which conflated two different things: a shop's tasting sheet
          // describes the wine, it doesn't say you drank it. The text is
          // still saved either way - it's content, not status - but which
          // field it lands in now follows whose words they are. Only the
          // owner's own become a TastingNote below, because that is what
          // "wines tasted" counts; a shelf talker's copy is criticNotes,
          // carried in by bottleDataFromWine.
          const status = statusForScanIntent(intent);
          try {
            const bottle = await prisma.bottle.create({
              data: {
                ...bottleDataFromWine(wine),
                status,
                emptiedAt: emptiedAtForStatus(status, null),
                acquiredAt: acquiredAtForStatus(status, null),
                needsResearch: wine.confident === false,
                photoUrl,
              },
            });
            if (wine.note) {
              try {
                await prisma.tastingNote.create({
                  data: { bottleId: bottle.id, note: wine.note, rating: null },
                });
              } catch (err) {
                console.error("Failed to save scanned tasting note:", err);
              }
            }
            revalidatePath(pathForStatus(status));
            results.push({ bottle: { ...bottle, scannedNote: wine.note ?? null } });
          } catch (err) {
            console.error("Failed to save scanned bottle:", err);
            results.push({ wine, saveError: true });
          }
        }
        invalidateRegionOptions();
        return { data: results };
      }

      const searchCalls = toolUses.filter((t) => t.name === "search_cellar");
      if (searchCalls.length === 0) {
        return { error: "Could not read that photo. Try a clearer, well-lit photo." };
      }

      // Claude can make several tool calls in the same turn (parallel tool
      // use). Every tool_use block needs a matching tool_result in the next
      // message, so answer all of them, not just the first.
      const toolResults = await Promise.all(
        searchCalls.map(async (call) => ({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(await searchCellar(call.input.query)),
        }))
      );

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
    return { error: "Could not read that photo. Try a clearer, well-lit photo." };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "The photo reader isn't configured correctly (invalid API key)." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "Too many photos at once — wait a moment and try again." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `Photo reader error: ${err.message}` };
    }
    return {
      error: "Something went wrong reading that photo. Please try again or enter the details manually.",
    };
  }
}

const BROWSE_CELLAR_TOOL = {
  name: "browse_cellar",
  description:
    "Browse this user's current inventory - bottles they actually own and could open tonight, not their wishlist or already-consumed bottles - to find candidates for a pairing or tasting recommendation. Call this one or more times with different filters to explore what's actually available (e.g. once for reds, once for whites) rather than assuming what's there. Returns `bottles` (at most 40, ordered by producer name), `totalMatching` (how many bottles actually matched your filters), and `truncated`. Each bottle has its id (needed to reference it in your final answer), producer, bottling, vintage, type, variety, region, country, quantity, average personal rating if any exists, drinkFrom/drinkTo (its drinking window, if known - null fields mean no window is recorded, not that it's unready), and drinkWindowEstimated (true when that window is the app's own guess rather than something read from a source or typed by the owner; only meaningful when a window is actually present). When `truncated` is true you are looking at an alphabetical slice, not the cellar - narrow the filters and call again rather than choosing from what came back.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: ["string", "null"],
        description: "Filter by the bottle's short type/style label, substring match (e.g. 'Pinot Noir', 'Sauvignon Blanc'). Null for no filter.",
      },
      region: {
        type: ["string", "null"],
        description: "Filter by region, substring match (e.g. 'Bordeaux', 'Oregon'). Null for no filter.",
      },
      country: {
        type: ["string", "null"],
        description: "Filter by country, substring match. Null for no filter.",
      },
      minVintage: {
        type: ["integer", "null"],
        description: "Only bottles from this vintage or later. Null for no minimum.",
      },
      maxVintage: {
        type: ["integer", "null"],
        description: "Only bottles from this vintage or earlier. Null for no maximum.",
      },
      readyToDrink: {
        type: ["boolean", "null"],
        description:
          "True to only return bottles whose drinking window (if any is set) includes the current year - i.e. not too young and not past peak. Bottles with no drinking window set are always included, since most wines don't have one recorded. Null for no filter (browse everything regardless of window).",
      },
    },
    required: ["type", "region", "country", "minVintage", "maxVintage", "readyToDrink"],
    additionalProperties: false,
  },
  strict: true,
};

const SUGGESTION_PICK_SCHEMA = {
  type: "object",
  properties: {
    bottleId: {
      type: ["integer", "null"],
      description:
        "The id of an existing inventory bottle returned by browse_cellar, if recommending something the user already owns. Null if this is a gap suggestion - something not currently owned that would be worth adding to the wishlist instead.",
    },
    pairingContext: {
      type: ["string", "null"],
      description:
        "For a pairing request only: which dish/course this wine goes with, in a few words (e.g. 'the grilled salmon'). Null for a tasting-flight request, or when there's only one dish and it's already obvious.",
    },
    reason: {
      type: "string",
      description:
        "Why this wine - the pairing logic, or how it fits the tasting theme and its place in the tasting order. A sentence or two.",
    },
    gapProducer: {
      type: ["string", "null"],
      description:
        "For a gap suggestion (bottleId null) only: a real, specific example producer for the style being suggested - not a vague placeholder. Null when bottleId is set.",
    },
    gapType: {
      type: ["string", "null"],
      description:
        "For a gap suggestion only: a short style/variety label, matching the app's `type` field convention (e.g. 'Sancerre', 'Riesling'). Null when bottleId is set.",
    },
    gapRegion: {
      type: ["string", "null"],
      description: "For a gap suggestion only. Null when bottleId is set.",
    },
    gapCountry: {
      type: ["string", "null"],
      description: "For a gap suggestion only. Null when bottleId is set.",
    },
  },
  required: [
    "bottleId",
    "pairingContext",
    "reason",
    "gapProducer",
    "gapType",
    "gapRegion",
    "gapCountry",
  ],
  additionalProperties: false,
};

const SUGGESTIONS_TOOL = {
  name: "record_suggestions",
  description:
    "Record your final wine recommendations, after browsing the cellar as needed. For a tasting flight, list picks in suggested tasting order.",
  input_schema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["pairing", "tasting"],
        description: "Which kind of request this was.",
      },
      title: {
        type: "string",
        description:
          "A short evocative name for this recommendation - a few words, the way a flight is named on a tasting menu ('The Many Faces of Pinot', 'Chalk and Sea Air', 'Three Ways with the Lamb'). Title Case, no trailing punctuation, and specific to these actual wines rather than a generic label like 'Tasting Flight' or 'Pairing Suggestions'. This is the heading on its own - do not restate the explanation here, that is what summary is for.",
      },
      summary: {
        type: "string",
        description:
          "The explanation behind the title: what the theme is, why these wines, and for a flight why they are in this order. Two to four sentences - this sits behind a 'Why these' disclosure, so it has room to be more than a caption.",
      },
      picks: {
        type: "array",
        description: "One entry per recommended wine.",
        items: SUGGESTION_PICK_SCHEMA,
      },
    },
    required: ["mode", "title", "summary", "picks"],
    additionalProperties: false,
  },
  strict: true,
};

async function browseCellar(filters) {
  const bottles = await prisma.bottle.findMany({
    where: { status: "inventory" },
    include: { tastingNotes: { select: { rating: true } } },
    orderBy: { producer: "asc" },
  });

  const withRating = bottles.map((bottle) => {
    const ratings = bottle.tastingNotes.map((t) => t.rating).filter((r) => r !== null);
    const averageRating = ratings.length
      ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
      : null;
    return { ...bottle, averageRating };
  });

  const currentYear = new Date().getFullYear();
  const matches = withRating.filter((bottle) => {
    if (filters.type && !bottle.type?.toLowerCase().includes(filters.type.toLowerCase())) {
      return false;
    }
    if (filters.region && !bottle.region?.toLowerCase().includes(filters.region.toLowerCase())) {
      return false;
    }
    if (filters.country && !bottle.country?.toLowerCase().includes(filters.country.toLowerCase())) {
      return false;
    }
    if (filters.minVintage && (!bottle.vintage || bottle.vintage < filters.minVintage)) {
      return false;
    }
    if (filters.maxVintage && (!bottle.vintage || bottle.vintage > filters.maxVintage)) {
      return false;
    }
    if (filters.readyToDrink) {
      // No window recorded is not "unready" - most wines don't have one.
      if (bottle.drinkFrom && currentYear < bottle.drinkFrom) return false;
      if (bottle.drinkTo && currentYear > bottle.drinkTo) return false;
    }
    return true;
  });

  const capped = matches.slice(0, 40);
  return {
    // The cap is invisible from the rows alone, and the ordering is
    // alphabetical by producer - so an unfiltered browse of a large cellar
    // returns the A's and nothing else, and a model that can't tell would
    // recommend the best of those as if it were the best of the cellar.
    totalMatching: matches.length,
    truncated: matches.length > capped.length,
    bottles: capped.map((bottle) => ({
      id: bottle.id,
      producer: bottle.producer,
      bottling: bottle.bottling,
      vintage: bottle.vintage,
      type: bottle.type,
      variety: bottle.variety,
      region: bottle.region,
      country: bottle.country,
      quantity: bottle.quantity,
      averageRating: bottle.averageRating,
      drinkFrom: bottle.drinkFrom,
      drinkTo: bottle.drinkTo,
      // Without this the model reads every window as established fact and
      // quotes the years back that way, which is the one place this feature
      // can quietly undo the guess/fact line the rest of the app holds.
      drinkWindowEstimated: bottle.drinkWindowEstimated,
    })),
  };
}

function buildSuggestSystemPrompt(currentYear, includeOutside, character) {
  // The cellar is always the default source. The difference is whether a
  // wine they don't own may be recommended on its merits, or only as an
  // admission that nothing owned fits.
  const outsideRule = includeOutside
    ? "They have asked to see wines beyond their own cellar for this request, so you may recommend wines they do not own wherever one would genuinely pair or fit better - not only as a fallback. Still prefer an owned bottle when it is a comparable match, since that is one they can open tonight; a wine they would have to go and buy has to earn its place by being clearly better for this. Record any such wine as a gap suggestion (bottleId null) with a real, specific producer, and say in its reason what it does that the owned options do not."
    : "Recommend only wines from their cellar. If nothing currently owned is a strong match, say so honestly and propose a specific gap suggestion (a real producer/style/region, not a vague category) worth adding to their wishlist, rather than forcing a mediocre owned bottle into the recommendation.";

  // Deliberately after outsideRule: how adventurous to be is a question
  // asked of whatever sources that rule has already allowed, and the
  // steer's own wording refers back to it. Empty - with no stray spacing -
  // when the character is Balanced, so an unsteered prompt is byte-for-byte
  // what it was before this control existed.
  const steer = characterRule(character);
  const steerRule = steer ? `${steer} ` : "";

  return `You help a home wine collector decide what to open, in one of two ways: PAIRING (they describe a meal or dish, possibly with multiple courses - recommend one or more wines from their own cellar for it) or TASTING (they describe a theme, goal, or mood - build an ordered flight of wines from their cellar exploring it). Infer which one from their request. Use browse_cellar (repeatedly, with different filters, rather than assuming what's there) to find real candidates from their actual current inventory - never invent a bottle they don't have. A browse_cellar result with truncated true is a partial view - the first 40 matches by producer name, not the best 40 - so narrow the filters and browse again before deciding, and never call a pick the best in their cellar on the strength of a truncated browse. The current year is ${currentYear} - browse_cellar returns each bottle's drinkFrom/drinkTo drinking window where one is recorded (null means none is recorded, not that it's unready). Prefer a bottle whose window (if any) includes ${currentYear}; avoid one that's too young (${currentYear} < drinkFrom) or past peak (${currentYear} > drinkTo) unless nothing better fits, in which case say so plainly in your reasoning for that pick rather than silently ignoring it. Each window also carries drinkWindowEstimated: true means the years are the app's own guess rather than anything anyone looked up, so treat them as approximate and don't claim where they came from; false means they were read from a source or entered by the owner. The flag only means anything when drinkFrom or drinkTo is actually set - for a bottle with no window at all, ignore it. Choose between bottles using an estimated window exactly as you would a sourced one, but never quote an estimated one back as established fact - write "estimated to be drinking now" or "roughly 2024-2028", not "drinking right in its window (2024-2028)". Every other screen marks an estimate as an estimate, and a recommendation that quietly promotes a guess to a fact is the one way this feature misleads. ${outsideRule} ${steerRule}For a tasting flight, order picks in the sequence they should be tasted (typically lightest/driest to fullest/sweetest, or whatever logic fits the theme) and explain that ordering in the summary. Every answer needs both a title and a summary, and they do different jobs: the title is a short evocative name shown as the heading and saved as the flight's name, the summary is the fuller explanation shown behind it. Don't let the title swell into a sentence, and don't let the summary open by restating the title. Call record_suggestions exactly once, when you're done, with your final answer.`;
}

// Turns a freeform request (a meal to pair, or a tasting theme/mood) into
// wine recommendations - grounded in the user's actual current inventory
// via browse_cellar, with gap suggestions (not owned, worth adding to the
// wishlist) where nothing owned fits well. Bottle data for owned picks is
// re-fetched fresh from the database rather than trusting the model's
// echoed fields, so what's displayed always matches what's actually saved.
export async function getSuggestions(
  request,
  includeOutside = false,
  character = null,
  effort = DEFAULT_EFFORT
) {
  const text = String(request || "").trim();
  if (!text) return { error: "Describe what you're working with first." };

  // Normalized once, so the prompt, the API request and the copy handed
  // back for saving all describe the same three settings.
  const steer = normalizeCharacter(character);
  const level = normalizeEffort(effort);
  const outside = Boolean(includeOutside);

  const messages = [{ role: "user", content: text }];
  const systemPrompt = buildSuggestSystemPrompt(
    new Date().getFullYear(),
    outside,
    steer
  );

  try {
    // Bounded to a few turns: normally some browse_cellar calls (possibly
    // several in parallel, exploring different filters) then
    // record_suggestions, but this caps it in case the model keeps browsing.
    for (let turn = 0; turn < 6; turn++) {
      const response = await anthropic.messages.create({
        model: REASONING_MODEL,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        // The owner's dial. Constant for the whole loop, so it never
        // invalidates the prefix cached below mid-run; across runs each
        // level keeps its own cached copy of that prefix, which costs one
        // cache write the first time a level is used.
        output_config: outputConfig(level),
        // Tools render before system, so one breakpoint here covers both.
        // The request text and every browse result live in messages, after
        // the prefix, so nothing volatile is inside it. The cache key
        // varies by year and by the includeOutside/character steer, which
        // is correct - a different steer is a different prompt.
        system: [
          { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
        ],
        tools: [BROWSE_CELLAR_TOOL, SUGGESTIONS_TOOL],
        messages,
      });

      const unusable = unusableResponseError(response, {
        refused:
          "Claude declined that request. Try describing the meal or the theme a different way.",
        truncated:
          "That suggestion ran out of room before it finished. Try a shorter description, or ask for fewer wines.",
      });
      if (unusable) return unusable;

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      const finalCall = toolUses.find((t) => t.name === "record_suggestions");
      if (finalCall) {
        const picks = finalCall.input.picks;
        const ownedIds = picks.map((p) => p.bottleId).filter((id) => id !== null);
        const ownedBottles = ownedIds.length
          ? await prisma.bottle.findMany({ where: { id: { in: ownedIds } } })
          : [];
        const bottleById = new Map(ownedBottles.map((b) => [b.id, b]));

        const resolvedPicks = picks
          .map((pick) => {
            const bottle = pick.bottleId !== null ? bottleById.get(pick.bottleId) ?? null : null;
            const gap =
              bottle === null && pick.bottleId === null
                ? {
                    producer: pick.gapProducer,
                    type: pick.gapType,
                    region: pick.gapRegion,
                    country: pick.gapCountry,
                  }
                : null;
            return { reason: pick.reason, pairingContext: pick.pairingContext, bottle, gap };
          })
          // Drop a pick that resolved to neither a real bottle nor a
          // usable gap suggestion (e.g. a hallucinated bottleId) rather
          // than render a broken card.
          .filter((pick) => pick.bottle || (pick.gap && pick.gap.producer));

        if (resolvedPicks.length === 0) {
          return { error: "Couldn't come up with a recommendation for that. Try describing it differently." };
        }

        return {
          data: {
            mode: finalCall.input.mode,
            title: finalCall.input.title,
            summary: finalCall.input.summary,
            picks: resolvedPicks,
            // Handed back rather than re-read from the form when the
            // pairing is kept. The form is still editable while the
            // result is on screen, so reading it at save time would file
            // a request that did not produce these wines - and it is
            // what a saved pairing is reloaded from to refine it.
            asked: {
              request: text,
              character: steer,
              includeOutside: outside,
              effort: level,
            },
          },
        };
      }

      const browseCalls = toolUses.filter((t) => t.name === "browse_cellar");
      if (browseCalls.length === 0) {
        return { error: "Couldn't come up with a recommendation for that. Try describing it differently." };
      }

      // Claude can make several tool calls in the same turn (parallel tool
      // use). Every tool_use block needs a matching tool_result in the next
      // message, so answer all of them, not just the first.
      const toolResults = await Promise.all(
        browseCalls.map(async (call) => ({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(await browseCellar(call.input)),
        }))
      );

      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }
    return { error: "Couldn't come up with a recommendation for that. Try again in a moment." };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "The suggestion feature isn't configured correctly (invalid API key)." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "Too many requests at once — wait a moment and try again." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `Suggestion error: ${err.message}` };
    }
    return { error: "Something went wrong getting suggestions. Please try again." };
  }
}

// A real, server-executed web search - unlike the scan/suggest features
// above, which only ever draw on the model's training knowledge (plus the
// user's own cellar). Anthropic runs the searches and feeds results back
// within the same call; max_uses just bounds how many it can run.
const WEB_SEARCH_TOOL = {
  type: "web_search_20260318",
  name: "web_search",
  max_uses: 5,
};

// The shape below is also the shape of ResearchProposal.proposed, minus
// `summary` and `sources`, which are stored as their own columns. That is
// the contract lib/research-fields.js reads against: add a field here and
// it must be added to RESEARCH_FIELDS too, or it will be saved into the
// proposal and never shown to anyone.
const RESEARCH_TOOL = {
  name: "record_research",
  description:
    "Record your final best-available fields for this wine, after researching it. Only change a field from its current value when research actually found or confirmed something - otherwise repeat the current value back rather than guess.",
  input_schema: {
    type: "object",
    properties: {
      bottling: {
        type: ["string", "null"],
        description: "Vineyard designation or proprietary/cuvée name, if any.",
      },
      vintage: { type: ["integer", "null"], description: "The vintage year." },
      type: {
        type: ["string", "null"],
        description: "Short, header-friendly style label (e.g. 'Zinfandel', 'Red Bordeaux Blend').",
      },
      variety: {
        type: ["string", "null"],
        description: "Fuller grape variety/blend description.",
      },
      region: { type: ["string", "null"], description: "Primary sub-country region or US state." },
      subRegion: {
        type: ["string", "null"],
        description: "A finer-grained locator within region, if known (e.g. 'Margaux' within Bordeaux).",
      },
      country: { type: ["string", "null"], description: "Country of origin." },
      abv: {
        type: ["number", "null"],
        description: "Alcohol by volume, e.g. 14.5 for '14.5%'.",
      },
      wineColor: {
        type: ["string", "null"],
        description: `One of ${WINE_COLORS.join(", ")} (exactly this spelling/casing), or null.`,
      },
      drinkFrom: {
        type: ["integer", "null"],
        description:
          "Start of the drinking window (a year). Prefer one your sources state. Where they don't, what to do depends on what the bottle already has, which the description above tells you: if there is no window on file, or the one on file is labelled as the app's own estimate, give your best estimate from the producer, region, style and vintage rather than leaving it blank - replacing one guess with a better-researched one is progress. If the window on file was read from a source or entered by the owner, repeat those years back unchanged; they may be the owner's own judgment, and overwriting them with yours is not research. Null only when you genuinely cannot judge.",
      },
      drinkWindowEstimated: {
        type: "boolean",
        description:
          "True when the window above is your own judgment rather than something your sources state outright. If you are repeating back a window that was already on file and that window was labelled as the app's own estimate, answer true - only your own sourcing can turn an estimate into a fact, and copying it forward is not sourcing it. The app marks an estimated window as such, so answer honestly - a guess labelled as sourced is worse than a guess labelled as a guess.",
      },
      drinkTo: {
        type: ["integer", "null"],
        description: "End of the drinking window (a year), same standard as drinkFrom.",
      },
      criticNotes: {
        type: ["string", "null"],
        description:
          "Existing winemaking/tasting notes about this wine, synthesized from what you found - the winery's own description, then major critics (Wine Advocate/Robert Parker, Wine Spectator, Halliday, Jancis Robinson), then other reviews/wine shops, roughly in that priority order. Attribute each part to its source (e.g. 'Winery: ...', 'Wine Spectator: ...'). Null if nothing credible was found.",
      },
      summary: {
        type: "string",
        description:
          "A short explanation for the user of what you found or confirmed, specific enough to justify each field you changed.",
      },
      sources: {
        type: "array",
        items: { type: "string" },
        description: "URLs of the most useful pages found via web_search. Empty array if none were needed.",
      },
    },
    required: [
      "bottling",
      "vintage",
      "type",
      "variety",
      "region",
      "subRegion",
      "country",
      "abv",
      "wineColor",
      "drinkFrom",
      "drinkTo",
      "criticNotes",
      "summary",
      "sources",
    ],
    additionalProperties: false,
  },
  strict: true,
};

const RESEARCH_SYSTEM_PROMPT =
  "You help fill in gaps or correct uncertain details for one wine already saved in a personal cellar-tracking app. You have a real web_search tool, not just training knowledge - use it (the producer's own site, retailer listings, critic write-ups) to verify or fill in what's uncertain, since your training data can be stale or the wine can be obscure/small-production. Don't invent specifics you can't find support for - keep a field as its current value rather than guess at a replacement. Also look for existing winemaking/tasting notes about this specific wine (ideally this vintage) to record in criticNotes: check the winery's own site first, then major critics (Wine Advocate/Robert Parker, Wine Spectator, Halliday, Jancis Robinson), then other online reviews or wine shop listings, in that priority order - synthesize what you find rather than just picking one source, and attribute each part to where it came from. Call record_research exactly once, when you're done researching, with your final answer.";

function describeBottleForResearch(bottle) {
  const lines = [
    `Producer: ${bottle.producer}`,
    bottle.bottling ? `Bottling: ${bottle.bottling}` : null,
    bottle.vintage ? `Vintage: ${bottle.vintage}` : null,
    bottle.type ? `Type: ${bottle.type}` : null,
    bottle.variety ? `Variety: ${bottle.variety}` : null,
    bottle.region ? `Region: ${bottle.region}` : null,
    bottle.subRegion ? `Sub-region: ${bottle.subRegion}` : null,
    bottle.country ? `Country: ${bottle.country}` : null,
    bottle.abv ? `ABV: ${bottle.abv}%` : null,
    bottle.wineColor ? `Color: ${bottle.wineColor}` : null,
    bottle.drinkFrom || bottle.drinkTo
      ? `Drinking window: ${bottle.drinkFrom ?? "?"}–${bottle.drinkTo ?? "?"}${
          bottle.drinkWindowEstimated
            ? " (the app's own estimate - nobody looked this up, so treat it as a placeholder to verify or replace, not as data on file)"
            : " (read from a source or entered by the owner)"
        }`
      : null,
    bottle.criticNotes ? `Existing critic/winemaker notes on file: ${bottle.criticNotes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

// Researches one already-saved bottle with a real web search (not just the
// Runs the web-search research call for one bottle and returns the model's
// answer. Separated from the action that stores it so a single bottle and a
// bulk pass share exactly one implementation of the expensive part.
async function runResearch(bottle, effort = DEFAULT_EFFORT) {
  const messages = [
    {
      role: "user",
      content: `Research this wine and fill in or correct anything uncertain:\n\n${describeBottleForResearch(bottle)}`,
    },
  ];

  try {
    // Bounded to a few turns: web_search itself runs server-side within a
    // single call, but a long research turn can come back with stop_reason
    // "pause_turn", which just needs re-sending (with the paused turn
    // appended) to continue rather than a fresh tool_result.
    for (let turn = 0; turn < 4; turn++) {
      const response = await anthropic.messages.create({
        model: EXTRACTION_MODEL,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        output_config: outputConfig(effort),
        system: RESEARCH_SYSTEM_PROMPT,
        tools: [WEB_SEARCH_TOOL, RESEARCH_TOOL],
        messages,
      });

      const unusable = unusableResponseError(response, {
        refused:
          "Claude declined to research that bottle. Its current details are unchanged.",
        truncated:
          "That research ran out of room before it finished. Nothing was changed — please try again.",
      });
      if (unusable) return unusable;

      const finalCall = response.content.find(
        (block) => block.type === "tool_use" && block.name === "record_research"
      );
      if (finalCall) {
        return { data: finalCall.input };
      }

      if (response.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      return { error: "Couldn't complete that research. Please try again." };
    }
    return { error: "That research is taking too long. Please try again." };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "The research feature isn't configured correctly (invalid API key)." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "Too many requests at once — wait a moment and try again." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `Research error: ${err.message}` };
    }
    return { error: "Something went wrong researching that bottle. Please try again." };
  }
}

// Researches one bottle and files the answer as a proposal waiting to be
// reviewed. Nothing about the bottle changes here - this is the "Claude
// proposes, you confirm" trust model the scan and suggest features follow,
// except the proposal now survives navigating away.
// Upsert, not create: researching a bottle twice should replace the
// pending answer rather than fail on the unique bottleId.
async function saveResearchProposal(bottleId, { proposed, summary, sources }) {
  await prisma.researchProposal.upsert({
    where: { bottleId },
    create: { bottleId, proposed, summary, sources: sources ?? [] },
    update: { proposed, summary, sources: sources ?? [], createdAt: new Date() },
  });
  revalidatePath(`/bottles/${bottleId}`);
}

// `effort` is the owner's thoroughness dial, offered on the bottle page.
// The other two callers - the scan card's "look it up" and the research
// queue - leave it alone: neither is a place where you are weighing one
// bottle's answer against the wait for it.
export async function researchBottle(id, effort = DEFAULT_EFFORT) {
  const bottle = await prisma.bottle.findUnique({ where: { id } });
  if (!bottle) return { error: "That bottle no longer exists." };

  const result = await runResearch(bottle, effort);
  if (result.error) return result;

  const { summary, sources, ...proposed } = result.data;
  await saveResearchProposal(id, { proposed, summary, sources });

  revalidatePath("/research");
  return { data: { changed: researchChanges(bottle, proposed).length } };
}

// The bulk pass. Chunked by the caller so no single request has to carry
// the whole queue. Each distinct wine is one web-search call, which is why
// the button that reaches this is behind a count and a confirmation - the
// count is of bottles, so it now overstates the searches rather than
// understating them.
export async function researchBottles(ids) {
  const bottles = await prisma.bottle.findMany({ where: { id: { in: ids } } });

  // Two rows of the same wine - a case split across two entries, or one
  // re-added after being drunk - ask the web the same question, and a
  // research pass is by some distance the most expensive call in the app.
  // Group them so the search runs once.
  //
  // The key is the research input itself rather than the wine's identity,
  // and that distinction is the safety property. A proposal is a diff
  // against one row's current values, so sharing an answer is only sound
  // when the question was word-for-word the same. Two rows of the same wine
  // that differ in anything research reads - a drinking window, whether
  // that window is the app's own guess or the owner's own judgment,
  // existing critic notes - describe differently and get their own pass.
  // Keying on identity alone would save more calls and would hand one row's
  // window provenance to another, which is the laundering the research
  // input labelling exists to prevent.
  const byQuestion = new Map();
  for (const bottle of bottles) {
    const key = describeBottleForResearch(bottle);
    if (!byQuestion.has(key)) byQuestion.set(key, []);
    byQuestion.get(key).push(bottle);
  }

  let researched = 0;
  let failed = 0;
  for (const group of byQuestion.values()) {
    const result = await runResearch(group[0]);
    if (result.error) {
      // One wine failing shouldn't cost the rest of the queue its
      // otherwise-good answers.
      failed += group.length;
      continue;
    }
    const { summary, sources, ...proposed } = result.data;
    for (const bottle of group) {
      try {
        await saveResearchProposal(bottle.id, { proposed, summary, sources });
        researched += 1;
      } catch (err) {
        console.error(`Failed to save research proposal for bottle ${bottle.id}:`, err);
        failed += 1;
      }
    }
  }

  revalidatePath("/research");
  return { data: { researched, failed } };
}

// Accepts a stored proposal as-is. The common case is that research got it
// right, and making that one click rather than a form submission is the
// whole point of having reviewed the diff first.
export async function applyResearchProposal(id) {
  const [bottle, proposal] = await Promise.all([
    prisma.bottle.findUnique({ where: { id }, select: { id: true } }),
    prisma.researchProposal.findUnique({ where: { bottleId: id } }),
  ]);
  if (!bottle) return { error: "That bottle no longer exists." };
  if (!proposal) return { error: "That proposal is no longer waiting." };

  // Only the fields research is allowed to touch, taken from the shared
  // list rather than spreading the Json blob straight into an update -
  // which would let an unexpected key through into the bottle row.
  const data = {};
  for (const { key } of RESEARCH_FIELDS) {
    data[key] = proposal.proposed[key] ?? null;
  }

  // Both or neither: a bottle updated but with its proposal still pending
  // would come straight back into the review queue claiming changes that
  // have already been applied.
  const [updated] = await prisma.$transaction([
    prisma.bottle.update({
      where: { id },
      data: {
        ...data,
        // The proposal already says whether its window was sourced or
        // judged, so carry that. Running it through the human-edit rule
        // instead would read "accepted a guess" as "confirmed a guess".
        drinkWindowEstimated: windowEstimatedFromProposal(data, proposal),
        needsResearch: false,
      },
    }),
    prisma.researchProposal.deleteMany({ where: { bottleId: id } }),
  ]);

  invalidateRegionOptions();
  revalidatePath(`/bottles/${id}`);
  revalidatePath("/research");
  revalidatePath(pathForStatus(updated.status));
  return { success: true };
}

// Applies reviewed/edited research output to the bottle and clears the
// research flag - a dedicated action (rather than routing through
// updateBottle) so a plain details-page edit never clears the flag as a
// side effect.
export async function applyResearch(id, prevState, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return { error: "Producer is required." };

  try {
    const [existing, proposal] = await Promise.all([
      prisma.bottle.findUnique({
        where: { id },
        select: { drinkFrom: true, drinkTo: true },
      }),
      prisma.researchProposal.findUnique({ where: { bottleId: id } }),
    ]);
    // Keeping the proposal's own years untouched means accepting its
    // answer, flag and all; typing different ones is the human making the
    // call, which is exactly what clearEstimatedFlagIfWindowChanged is for.
    const keptProposedWindow =
      proposal &&
      (proposal.proposed.drinkFrom ?? null) === data.drinkFrom &&
      (proposal.proposed.drinkTo ?? null) === data.drinkTo;
    const withFlag = keptProposedWindow
      ? { ...data, drinkWindowEstimated: windowEstimatedFromProposal(data, proposal) }
      : clearEstimatedFlagIfWindowChanged(data, existing);
    // Edited and saved settles the proposal just as much as accepting it
    // does; leaving it would put the bottle straight back in the review
    // queue with an answer that has already been dealt with.
    const [bottle] = await prisma.$transaction([
      prisma.bottle.update({
        where: { id },
        data: { ...withFlag, needsResearch: false },
      }),
      prisma.researchProposal.deleteMany({ where: { bottleId: id } }),
    ]);
    invalidateRegionOptions();
    revalidatePath(`/bottles/${id}`);
    revalidatePath("/research");
    revalidatePath(pathForStatus(bottle.status));
    return { success: true };
  } catch (err) {
    console.error("Failed to apply research:", err);
    return { error: "Couldn't save those changes. Please try again." };
  }
}

// Clears the research flag without changing any fields - for when the
// existing details are judged fine as-is. Also drops any pending proposal,
// since "keep as is" is an answer to one: without this the bottle would
// leave the to-research list and immediately reappear in the review one.
export async function dismissResearch(id) {
  try {
    await prisma.$transaction([
      prisma.bottle.update({ where: { id }, data: { needsResearch: false } }),
      prisma.researchProposal.deleteMany({ where: { bottleId: id } }),
    ]);
    revalidatePath(`/bottles/${id}`);
    revalidatePath("/research");
    return { ok: true };
  } catch (err) {
    console.error("Failed to dismiss research for a bottle:", err);
    return { error: "Couldn't clear that flag. Please try again." };
  }
}

const DRINK_WINDOW_ESTIMATE_TOOL = {
  name: "record_drink_window_estimates",
  description:
    "Record an estimated drinking window for each wine listed, using general knowledge of the producer, variety, region, and vintage - not a web search. This is a bulk pass across many wines that currently have no drinking window on file at all, so always give your best estimate for every wine rather than leaving one blank; only use null for a field you genuinely have no reasonable basis to guess (e.g. the vintage itself isn't known).",
  input_schema: {
    type: "object",
    properties: {
      estimates: {
        type: "array",
        description: "One entry per wine listed, in the same order, each echoing back its id.",
        items: {
          type: "object",
          properties: {
            id: { type: "integer", description: "The wine's id, exactly as given in the input list." },
            drinkFrom: {
              type: ["integer", "null"],
              description: "Estimated start year of the drinking window.",
            },
            drinkTo: {
              type: ["integer", "null"],
              description: "Estimated end year of the drinking window.",
            },
          },
          required: ["id", "drinkFrom", "drinkTo"],
          additionalProperties: false,
        },
      },
    },
    required: ["estimates"],
    additionalProperties: false,
  },
  strict: true,
};

const DRINK_WINDOW_SYSTEM_PROMPT =
  "You estimate drinking windows (the year range a wine is expected to be at its best) for a batch of wines already in a personal cellar, using your general knowledge of the producer, variety, region, and vintage - not a web search. You are asked about wines with no window on file at all - sometimes a whole cellar's worth, sometimes a single bottle - so bias toward giving a genuine best estimate rather than null - a rough estimate the owner can refine later is far more useful than a blank field. Call record_drink_window_estimates exactly once with one entry per wine listed, in the same order, echoing back each id.";

function describeBottleForWindowEstimate(bottle) {
  return [
    bottle.producer,
    bottle.bottling,
    bottle.vintage,
    bottle.type || bottle.variety,
    bottle.region,
    bottle.subRegion,
    bottle.country,
  ]
    .filter(Boolean)
    .join(", ");
}

// One-time bulk pass over inventory bottles with no drinking window at all
// One estimate onto one bottle. Shared by the bulk pass and the
// single-bottle action so neither can forget the part that matters: an
// estimate is always stored marked as an estimate.
async function writeWindowEstimate(bottleId, { drinkFrom, drinkTo }) {
  await prisma.bottle.update({
    where: { id: bottleId },
    data: { drinkFrom, drinkTo, drinkWindowEstimated: true },
  });
}

// Failing to remember an answer is never a reason to discard it, so this
// swallows its own errors.
async function cacheWindowEstimate(key, { drinkFrom, drinkTo }) {
  try {
    await prisma.drinkWindowEstimate.upsert({
      where: { key },
      create: { key, drinkFrom, drinkTo },
      update: { drinkFrom, drinkTo },
    });
  } catch (err) {
    console.error(`Failed to cache drink window estimate for ${key}:`, err);
  }
}

// What the estimate needs to know about a wine - the same shape the cache
// key is built from, plus the id.
const WINDOW_ESTIMATE_SELECT = {
  id: true,
  producer: true,
  bottling: true,
  vintage: true,
  type: true,
  variety: true,
  canonicalVariety: true,
  region: true,
  subRegion: true,
  country: true,
};

// (both drinkFrom and drinkTo null - a partial window someone deliberately
// left open-ended is never touched). Applies estimates directly rather
// than reviewing one by one, since that isn't practical at the hundreds-
// of-bottles scale this is meant for - see BACKLOG.md #7. The caller
// (EstimateWindowsPanel) chunks the full list client-side and calls this
// once per chunk, so a single request never has to process the whole
// cellar at once (and stays well under a serverless function's execution
// limit).
export async function estimateDrinkWindows(bottleIds) {
  const bottles = await prisma.bottle.findMany({
    where: { id: { in: bottleIds } },
    select: WINDOW_ESTIMATE_SELECT,
  });
  if (bottles.length === 0) return { data: { updated: 0, total: 0, fromCache: 0 } };

  // Applies one estimate to every bottle that shares its wine - the answer
  // is about the wine, not about a particular row.
  async function applyToBottles(targets, { drinkFrom, drinkTo }) {
    let applied = 0;
    for (const bottle of targets) {
      try {
        await writeWindowEstimate(bottle.id, { drinkFrom, drinkTo });
        applied++;
      } catch (err) {
        // One bad id (e.g. a bottle deleted mid-run) shouldn't cost the
        // rest of the batch its otherwise-good estimates.
        console.error(`Failed to apply drink window estimate for bottle ${bottle.id}:`, err);
      }
    }
    return applied;
  }

  // Group the batch by wine, so a cellar holding the same wine in two rows
  // (or the same wine re-added later) asks once rather than once per row.
  const byKey = new Map();
  for (const bottle of bottles) {
    const key = drinkWindowCacheKey(bottle);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(bottle);
  }

  const cached = await prisma.drinkWindowEstimate.findMany({
    where: { key: { in: [...byKey.keys()] } },
  });

  let updated = 0;
  let fromCache = 0;
  for (const entry of cached) {
    const targets = byKey.get(entry.key);
    if (!targets) continue;
    const applied = await applyToBottles(targets, entry);
    updated += applied;
    fromCache += applied;
    byKey.delete(entry.key);
  }

  // Everything left needs asking. One representative bottle per wine goes
  // to Claude; its answer is then applied to all the rows sharing that key.
  const toAsk = [...byKey.entries()].map(([key, targets]) => ({ key, bottle: targets[0] }));
  if (toAsk.length === 0) {
    revalidatePath("/inventory");
    return { data: { updated, total: bottles.length, fromCache } };
  }

  const listText = toAsk
    .map(({ bottle }) => `id ${bottle.id}: ${describeBottleForWindowEstimate(bottle)}`)
    .join("\n");
  const keyByBottleId = new Map(toAsk.map(({ key, bottle }) => [bottle.id, key]));

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      output_config: outputConfig(DEFAULT_EFFORT),
      system: DRINK_WINDOW_SYSTEM_PROMPT,
      tools: [DRINK_WINDOW_ESTIMATE_TOOL],
      messages: [
        {
          role: "user",
          content: `Estimate a drinking window for each of these wines:\n\n${listText}`,
        },
      ],
    });

    const unusable = unusableResponseError(response, {
      refused:
        "Claude declined to estimate that batch. Nothing was changed.",
      truncated:
        "That batch was too large to finish in one go. Any wines it did estimate are saved, and running it again will skip those and pick up the rest.",
    });
    if (unusable) return unusable;

    const finalCall = response.content.find(
      (block) => block.type === "tool_use" && block.name === "record_drink_window_estimates"
    );
    if (!finalCall) return { error: "Couldn't estimate that batch. Please try again." };

    for (const estimate of finalCall.input.estimates) {
      // An all-null answer is deliberately not cached: the model having
      // nothing this time shouldn't permanently stop us asking again.
      if (estimate.drinkFrom == null && estimate.drinkTo == null) continue;
      const key = keyByBottleId.get(estimate.id);
      if (!key) continue;

      await cacheWindowEstimate(key, estimate);
      updated += await applyToBottles(byKey.get(key) ?? [], estimate);
    }

    revalidatePath("/inventory");
    return { data: { updated, total: bottles.length, fromCache } };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "The estimate feature isn't configured correctly (invalid API key)." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "Too many requests at once — wait a moment and try again." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `Estimate error: ${err.message}` };
    }
    return { error: "Something went wrong estimating that batch. Please try again." };
  }
}

// The gap the bulk pass doesn't cover: one bottle, on demand. A wine added
// by hand never goes past the scanner, and the backfill only runs when you
// remember to open it - so without this, "every add path fills the window
// in" isn't true of the most deliberate add path there is.
//
// Same tool, same prompt and the same cache as the backfill, because the
// answer is about the wine rather than about how it was asked for: a
// bottle estimated here costs nothing when the bulk pass later meets the
// same wine, and vice versa. No web search - that's what Research is for,
// and it costs a great deal more.
export async function estimateWindowForBottle(id) {
  const bottle = await prisma.bottle.findUnique({
    where: { id },
    select: WINDOW_ESTIMATE_SELECT,
  });
  if (!bottle) return { error: "That bottle no longer exists." };
  if (!bottle.producer) {
    return { error: "Add a producer first — there's nothing to estimate from." };
  }

  const key = drinkWindowCacheKey(bottle);
  const cached = await prisma.drinkWindowEstimate.findUnique({ where: { key } });
  if (cached) {
    await writeWindowEstimate(id, cached);
    revalidatePath(`/bottles/${id}`);
    revalidatePath("/inventory");
    return {
      data: { drinkFrom: cached.drinkFrom, drinkTo: cached.drinkTo, fromCache: true },
    };
  }

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      output_config: outputConfig(DEFAULT_EFFORT),
      system: DRINK_WINDOW_SYSTEM_PROMPT,
      tools: [DRINK_WINDOW_ESTIMATE_TOOL],
      messages: [
        {
          role: "user",
          content: `Estimate a drinking window for this wine:\n\nid ${bottle.id}: ${describeBottleForWindowEstimate(bottle)}`,
        },
      ],
    });

    const unusable = unusableResponseError(response, {
      refused:
        "Claude declined to estimate a window for this bottle.",
      truncated:
        "That estimate ran out of room before it finished. Please try again.",
    });
    if (unusable) return unusable;

    const finalCall = response.content.find(
      (block) => block.type === "tool_use" && block.name === "record_drink_window_estimates"
    );
    const estimate = finalCall?.input?.estimates?.[0];
    if (!estimate) return { error: "Couldn't estimate that one. Please try again." };
    if (estimate.drinkFrom == null && estimate.drinkTo == null) {
      // Not cached, deliberately: having nothing to say this time
      // shouldn't permanently stop the app asking about this wine.
      return { error: "Not enough to go on for this wine — try Research instead." };
    }

    await cacheWindowEstimate(key, estimate);
    await writeWindowEstimate(id, estimate);
    revalidatePath(`/bottles/${id}`);
    revalidatePath("/inventory");
    return {
      data: { drinkFrom: estimate.drinkFrom, drinkTo: estimate.drinkTo, fromCache: false },
    };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "The estimate feature isn't configured correctly (invalid API key)." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "Too many requests at once — wait a moment and try again." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `Estimate error: ${err.message}` };
    }
    return { error: "Something went wrong estimating that one. Please try again." };
  }
}

const PHOTO_DETAILS_TOOL = {
  name: "record_photo_details",
  description:
    "Record updated fields for this already-saved wine, based on what this new photo shows (e.g. a back label, a cork, a case) - not the original front-label photo already on file. Only change a field when this photo actually shows or confirms something new; otherwise repeat the current value back rather than guess.",
  input_schema: {
    type: "object",
    properties: {
      bottling: {
        type: ["string", "null"],
        description: "Vineyard designation or proprietary/cuvée name, if any.",
      },
      vintage: { type: ["integer", "null"], description: "The vintage year." },
      type: {
        type: ["string", "null"],
        description: "Short, header-friendly style label (e.g. 'Zinfandel', 'Red Bordeaux Blend').",
      },
      variety: {
        type: ["string", "null"],
        description: "Fuller grape variety/blend description.",
      },
      region: { type: ["string", "null"], description: "Primary sub-country region or US state." },
      subRegion: {
        type: ["string", "null"],
        description: "A finer-grained locator within region, if known (e.g. 'Margaux' within Bordeaux).",
      },
      country: { type: ["string", "null"], description: "Country of origin." },
      abv: {
        type: ["number", "null"],
        description: "Alcohol by volume, e.g. 14.5 for '14.5%'.",
      },
      wineColor: {
        type: ["string", "null"],
        description: `One of ${WINE_COLORS.join(", ")} (exactly this spelling/casing), or null.`,
      },
      drinkFrom: {
        type: ["integer", "null"],
        description: "Start of the drinking window (a year), only if genuinely well-supported.",
      },
      drinkTo: {
        type: ["integer", "null"],
        description: "End of the drinking window (a year), same standard as drinkFrom.",
      },
      drinkWindowEstimated: {
        type: "boolean",
        description:
          "True when the window above is your own judgment rather than one printed in this photo. Almost always true - very few labels print a drinking window - and the app marks an estimated window as such either way, so answer honestly.",
      },
      criticNotes: {
        type: ["string", "null"],
        description:
          "Winemaking/tasting-note text visible on this photo (e.g. a back label's own description) - merged with what's already on file if useful, rather than dropped. Null if nothing relevant is visible.",
      },
      summary: {
        type: "string",
        description: "A short explanation of what this photo shows and what you changed.",
      },
    },
    required: [
      "bottling",
      "vintage",
      "type",
      "variety",
      "region",
      "subRegion",
      "country",
      "abv",
      "wineColor",
      "drinkFrom",
      "drinkTo",
      "criticNotes",
      "summary",
    ],
    additionalProperties: false,
  },
  strict: true,
};

const PHOTO_DETAILS_SYSTEM_PROMPT =
  "You help fill in gaps or correct uncertain details for one wine already saved in a personal cellar-tracking app, based on a new photo the user just took of it (a back label, a cork, a case - not the original front-label photo already on file). Read what's actually visible in the photo and propose updated fields; don't invent or guess at anything not shown. Keep a field as its current value rather than guess. Call record_photo_details exactly once, when you're done reading the photo, with your final answer.";

// Reads an additional photo of an already-saved bottle (added alongside
// addBottlePhoto below) and proposes field updates from what it actually
// shows - a back label's ABV or tasting notes, a case's vintage, etc. Same
// review-before-save trust model as researchBottle: nothing is saved
// automatically, the bottle page shows this as an editable, prefilled form.
export async function extractBottlePhotoDetails(bottleId, base64Image, mediaType) {
  const bottle = await prisma.bottle.findUnique({ where: { id: bottleId } });
  if (!bottle) return { error: "That bottle no longer exists." };

  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Image },
        },
        {
          type: "text",
          text: `Read this photo and propose updated details for this already-saved wine:\n\n${describeBottleForResearch(bottle)}`,
        },
      ],
    },
  ];

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: outputConfig(DEFAULT_EFFORT),
      system: PHOTO_DETAILS_SYSTEM_PROMPT,
      tools: [PHOTO_DETAILS_TOOL],
      messages,
    });

    const unusable = unusableResponseError(response, {
      refused:
        "Claude declined to read that photo. The photo itself was still saved to this bottle.",
      truncated:
        "Reading that photo ran out of room before it finished. The photo itself was still saved — try again, or edit the bottle by hand.",
    });
    if (unusable) return unusable;

    const finalCall = response.content.find(
      (block) => block.type === "tool_use" && block.name === "record_photo_details"
    );
    if (finalCall) return { data: finalCall.input };
    return { error: "Couldn't read that photo. Please try again." };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "The photo reader isn't configured correctly (invalid API key)." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "Too many requests at once — wait a moment and try again." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `Photo reader error: ${err.message}` };
    }
    return { error: "Something went wrong reading that photo. Please try again." };
  }
}

// The photo panel can't save through updateBottle. A drinking window the
// photo read proposed is the model's own judgment, but updateBottle treats
// any change to the years as the human making the call and clears
// drinkWindowEstimated - which would strip the "estimated" marker off a
// pure guess and show it as fact. This is the same split applyResearch
// makes, with the proposed answer passed in from the panel's own state
// rather than read back from a stored ResearchProposal row.
export async function applyPhotoDetails(id, proposed, prevState, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return { error: "Producer is required." };

  try {
    const existing = await prisma.bottle.findUnique({
      where: { id },
      select: { drinkFrom: true, drinkTo: true },
    });
    // Leaving the proposed years untouched means accepting the photo's
    // answer, flag and all; typing different ones is the human deciding,
    // which is exactly what clearEstimatedFlagIfWindowChanged is for.
    const keptProposedWindow =
      (proposed?.drinkFrom ?? null) === data.drinkFrom &&
      (proposed?.drinkTo ?? null) === data.drinkTo;
    const withFlag = keptProposedWindow
      ? // windowEstimatedFromProposal reads a stored proposal record; the
        // photo read's answer is that same shape one level up.
        { ...data, drinkWindowEstimated: windowEstimatedFromProposal(data, { proposed }) }
      : clearEstimatedFlagIfWindowChanged(data, existing);
    const bottle = await prisma.bottle.update({ where: { id }, data: withFlag });
    invalidateRegionOptions();
    revalidatePath(`/bottles/${id}`);
    revalidatePath(pathForStatus(bottle.status));
    return { success: true, bottle };
  } catch (err) {
    console.error("Failed to apply photo details:", err);
    return { error: "Couldn't save those changes. Please try again." };
  }
}

// Adds one more photo to an already-saved bottle - a back label, a cork, a
// case, anything worth keeping alongside the original scanned label -
// akin to how the Research feature adds detail after the fact rather than
// only at save time. Not read by any AI feature itself, just stored and
// shown back (extractBottlePhotoDetails above is what reads it). Takes the
// already-downscaled base64 image straight from the client (same shape as
// extractWinesFromPhoto), since there's no plain form-post path for a file
// this large through a Server Action bound to a specific bottle.
export async function addBottlePhoto(bottleId, base64Image, mediaType) {
  const { url, error } = await uploadLabelPhoto(base64Image, mediaType);
  if (!url) {
    return {
      error: error
        ? `Couldn't upload that photo — ${error}`
        : "Couldn't upload that photo — photo storage isn't configured.",
    };
  }
  await prisma.bottlePhoto.create({ data: { bottleId, url } });
  revalidatePath(`/bottles/${bottleId}`);
  return { success: true };
}

export async function deleteBottlePhoto(id) {
  const photo = await prisma.bottlePhoto.delete({ where: { id } });
  revalidatePath(`/bottles/${photo.bottleId}`);
}

// A lightweight stand-in for real accounts: a guest just picks a name (no
// password), looked up case-insensitively so re-entering the same name
// from a new browser reuses the existing guest record rather than forking
// it - fine for a small circle of friends/family, not meant to prove
// identity. Real per-person accounts (separate cellars) are a bigger,
// separate capability - see FUTURE_CAPABILITIES.md.
export async function enterAsGuest(formData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  let guest = await prisma.guest.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (!guest) {
    guest = await prisma.guest.create({ data: { name } });
  }

  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE, String(guest.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  redirect("/guest");
}

// Lets someone else use the same browser as a different guest.
export async function switchGuest() {
  const cookieStore = await cookies();
  // Re-set with maxAge 0 (rather than delete()) so every attribute matches
  // exactly what enterAsGuest set the cookie with - the browser only
  // clears a cookie when path/sameSite/etc. line up.
  cookieStore.set(GUEST_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  redirect("/guest");
}

export async function toggleFavorite(bottleId) {
  const guest = await getCurrentGuest();
  if (!guest) return;

  const existing = await prisma.favorite.findUnique({
    where: { guestId_bottleId: { guestId: guest.id, bottleId } },
  });
  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.favorite.create({ data: { guestId: guest.id, bottleId } });
  }
  revalidatePath("/guest");
  revalidatePath("/inventory");
  revalidatePath(`/bottles/${bottleId}`);
}

// Saves a Suggest tasting-flight result as a queue to pull bottles from
// later, rather than letting it disappear once the page is left. Only
// picks tied to a real owned bottle are stored - a gap suggestion mixed
// into the same result isn't something to "pull from the cellar" and can
// already be added to the wishlist independently.
export async function saveTastingFlight({ title, summary, picks }) {
  const ownedPicks = picks.filter((p) => Number.isInteger(p.bottleId));
  if (ownedPicks.length === 0) return { error: "Nothing in that flight was an owned bottle to save." };

  const flight = await prisma.tastingFlight.create({
    data: {
      // Null rather than falling back to the summary: a flight with no
      // title of its own should show its summary as the heading because
      // that's all it has, not because a copy was written into the column.
      title: title?.trim() || null,
      summary,
      picks: {
        create: ownedPicks.map((pick, index) => ({
          bottleId: pick.bottleId,
          reason: pick.reason,
          order: index,
        })),
      },
    },
  });
  revalidatePath("/flights");
  return { data: { id: flight.id } };
}

// Starts an empty flight by hand. A theme name is the only thing actually
// required - the description is where you say what the theme is *for*, and
// plenty of flights don't need one.
export async function createFlight(prevState, formData) {
  const title = String(formData.get("title") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  if (!title) return { error: "Give the flight a theme name." };

  const flight = await prisma.tastingFlight.create({
    data: { title, summary: summary || null },
  });
  revalidatePath("/flights");
  redirect(`/flights/${flight.id}`);
}

// Appends a bottle to the end of a flight's running order. Called from the
// flight's own page and from a bottle card anywhere in inventory, so it
// can't assume the caller knew what was already in there.
export async function addBottleToFlight(flightId, bottleId) {
  const [flight, bottle] = await Promise.all([
    prisma.tastingFlight.findUnique({
      where: { id: flightId },
      select: { id: true, title: true, summary: true },
    }),
    prisma.bottle.findUnique({ where: { id: bottleId }, select: { id: true } }),
  ]);
  if (!flight) return { error: "That flight no longer exists." };
  if (!bottle) return { error: "That bottle no longer exists." };

  // Checked here rather than with a unique constraint on (flightId,
  // bottleId): flights saved from Suggest before this existed could
  // already contain a repeat, and a migration that fails on live data is
  // a worse trade than a guard in the one function that adds picks.
  const existing = await prisma.flightPick.findFirst({
    where: { flightId, bottleId },
    select: { id: true },
  });
  if (existing) return { error: "That bottle is already in this flight." };

  const last = await prisma.flightPick.findFirst({
    where: { flightId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.flightPick.create({
    data: { flightId, bottleId, order: (last?.order ?? -1) + 1, reason: null },
  });
  revalidatePath(`/flights/${flightId}`);
  revalidatePath("/flights");
  return { data: { flightName: flight.title || flight.summary || "the flight" } };
}

export async function removeFlightPick(pickId) {
  const pick = await prisma.flightPick.delete({ where: { id: pickId } });
  revalidatePath(`/flights/${pick.flightId}`);
  revalidatePath("/flights");
}

// Swaps a pick with its neighbour. Works off position in the sorted list
// rather than arithmetic on `order`, because orders are only guaranteed to
// be increasing - a removal leaves a gap, and nothing renumbers them.
export async function moveFlightPick(pickId, direction) {
  const pick = await prisma.flightPick.findUnique({
    where: { id: pickId },
    select: { id: true, flightId: true },
  });
  if (!pick) return;

  const picks = await prisma.flightPick.findMany({
    where: { flightId: pick.flightId },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });

  const index = picks.findIndex((p) => p.id === pickId);
  const target = index + (direction === "up" ? -1 : 1);
  if (index === -1 || target < 0 || target >= picks.length) return;

  // Both rows or neither: a half-applied swap would put two picks on the
  // same order and make the list's sequence arbitrary.
  await prisma.$transaction([
    prisma.flightPick.update({
      where: { id: picks[index].id },
      data: { order: picks[target].order },
    }),
    prisma.flightPick.update({
      where: { id: picks[target].id },
      data: { order: picks[index].order },
    }),
  ]);
  revalidatePath(`/flights/${pick.flightId}`);
}

// Decrements the bottle the same way the bottle page's own "Tasted one"
// button does (BACKLOG #29) - a flight is normally opened and poured
// through in one sitting, so "tasted" here should mean the same thing it
// means everywhere else in the app, not a checklist tick disconnected from
// what's actually left in the cellar. Guarded on `pick.consumed` so a
// resubmit (a double-tap before the page revalidates) can't decrement the
// bottle twice.
export async function markFlightPickConsumed(pickId) {
  const pick = await prisma.flightPick.findUnique({ where: { id: pickId } });
  if (!pick || pick.consumed) return;

  await prisma.flightPick.update({
    where: { id: pickId },
    data: { consumed: true },
  });
  await markOneTasted(pick.bottleId);
  revalidatePath(`/flights/${pick.flightId}`);
  revalidatePath("/flights");
}

// The mirror of markOneTasted, reusing setBottleStatus and
// adjustBottleQuantity rather than duplicating their logic - a bottle
// undone this way ends up exactly where either of those would have left
// it, not a hand-rolled approximation of the same state.
async function undoOneTasted(id) {
  const bottle = await prisma.bottle.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!bottle) return;

  if (bottle.status === "consumed") {
    await setBottleStatus(id, "inventory");
  } else {
    await adjustBottleQuantity(id, 1);
  }
}

// Undoes markFlightPickConsumed - marking a pick tasted now moves real
// inventory (BACKLOG #29), not just a checklist flag, so a mis-tap needs a
// way back the same way every other consequential action in this app
// does. Guarded the same way its counterpart is, so a resubmit can't
// double-restore.
export async function unmarkFlightPickConsumed(pickId) {
  const pick = await prisma.flightPick.findUnique({ where: { id: pickId } });
  if (!pick || !pick.consumed) return;

  await prisma.flightPick.update({
    where: { id: pickId },
    data: { consumed: false },
  });
  await undoOneTasted(pick.bottleId);
  revalidatePath(`/flights/${pick.flightId}`);
  revalidatePath("/flights");
}

export async function deleteTastingFlight(id) {
  await prisma.tastingFlight.delete({ where: { id } });
  revalidatePath("/flights");
  redirect("/flights");
}

// A pairing is kept only when the owner says so - unlike a flight, which
// is a queue you build, a pairing is a decision you either want a record
// of or you don't. Everything below therefore runs on a Suggest result
// that is still on screen.
//
// Every argument here arrived from a browser, so nothing is trusted: the
// two steers are normalized, the text is bounded, and each pick's wine is
// re-resolved against the database rather than labelled from whatever the
// client sent.
const MAX_PAIRING_PICKS = 24;
const MAX_PAIRING_TEXT = 4000;

function trimmedOrNull(value, max = 500) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

// The four fields a gap suggestion carries, and nothing else - the value
// is stored as Json, so it is the one place a client could otherwise put
// anything it liked into the database.
function gapFromInput(gap) {
  const producer = trimmedOrNull(gap?.producer, 200);
  if (!producer) return null;
  return {
    producer,
    type: trimmedOrNull(gap?.type, 200),
    region: trimmedOrNull(gap?.region, 200),
    country: trimmedOrNull(gap?.country, 200),
  };
}

export async function savePairing(input) {
  const request = String(input?.request ?? "").trim();
  if (!request) return { error: "That suggestion is missing what you asked for." };

  const rawPicks = Array.isArray(input?.picks)
    ? input.picks.slice(0, MAX_PAIRING_PICKS)
    : [];
  if (rawPicks.length === 0) return { error: "There are no wines in that suggestion to keep." };

  // One query for every owned wine in the pairing, which both checks the
  // bottles are real and supplies the labels. A pick naming a bottle that
  // has since been deleted is dropped rather than saved label-less - the
  // same call getSuggestions makes when a pick resolves to nothing.
  const bottleIds = rawPicks
    .map((pick) => pick.bottleId)
    .filter((id) => Number.isInteger(id));
  const bottles = bottleIds.length
    ? await prisma.bottle.findMany({ where: { id: { in: bottleIds } } })
    : [];
  const bottleById = new Map(bottles.map((bottle) => [bottle.id, bottle]));

  const picks = [];
  for (const pick of rawPicks) {
    const bottle = Number.isInteger(pick.bottleId)
      ? bottleById.get(pick.bottleId) ?? null
      : null;
    const gap = bottle ? null : gapFromInput(pick.gap);
    if (!bottle && !gap) continue;

    picks.push({
      order: picks.length,
      dish: trimmedOrNull(pick.dish),
      reason: trimmedOrNull(pick.reason, MAX_PAIRING_TEXT) ?? "",
      bottleId: bottle ? bottle.id : null,
      wineLabel: bottle ? wineLabelForBottle(bottle) : wineLabelForGap(gap),
      wineName: bottle ? wineNameForBottle(bottle) : wineNameForGap(gap),
      gap,
    });
  }
  if (picks.length === 0) {
    return { error: "None of those wines could be saved — they may have been removed since." };
  }

  // The model's own title is the default, per the owner's call, and the
  // detail page is where it gets renamed. The fallback is only for a
  // result that somehow arrived without one: a pairing with no heading
  // would be a row you cannot find again.
  const title =
    trimmedOrNull(input?.title, 200) ?? `Pairing for ${request.slice(0, 60)}`;

  try {
    const pairing = await prisma.savedPairing.create({
      data: {
        title,
        request: request.slice(0, MAX_PAIRING_TEXT),
        character: normalizeCharacter(input?.character),
        effort: normalizeEffort(input?.effort),
        includeOutside: Boolean(input?.includeOutside),
        summary: trimmedOrNull(input?.summary, MAX_PAIRING_TEXT),
        picks: { create: picks },
      },
    });
    revalidatePath("/pairings");
    return { data: { id: pairing.id, kept: picks.length } };
  } catch (err) {
    console.error("Failed to save a pairing:", err);
    return { error: "Couldn't keep that pairing. Please try again." };
  }
}

// Renaming is the whole of "allow modification": the request, the steers
// and the wines are a record of what happened and are not editable, but
// what you call it is yours.
export async function renamePairing(id, formData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Give it a name." };

  try {
    await prisma.savedPairing.update({
      where: { id },
      data: { title: title.slice(0, 200) },
    });
    revalidatePath(`/pairings/${id}`);
    revalidatePath("/pairings");
    return { success: true };
  } catch (err) {
    console.error("Failed to rename a pairing:", err);
    return { error: "Couldn't save that name. Please try again." };
  }
}

export async function deletePairing(id) {
  await prisma.savedPairing.delete({ where: { id } });
  revalidatePath("/pairings");
  redirect("/pairings");
}
