"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { GUEST_COOKIE, getCurrentGuest } from "@/lib/guest";
import { canonicalizeVarietal } from "@/lib/varietal-match";
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
    criticNotes: null,
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
    return await prisma.bottle.create({ data: { ...data, status, needsResearch, photoUrl } });
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
    revalidatePath(`/bottles/${id}`);
    revalidatePath(pathForStatus(bottle.status));
    return { success: true };
  } catch (err) {
    console.error("Failed to update bottle:", err);
    return { error: "Couldn't save those changes. Please try again." };
  }
}

export async function setBottleStatus(id, status) {
  await prisma.bottle.update({ where: { id }, data: { status } });
  revalidatePath(`/bottles/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/wishlist");
  revalidatePath("/consumed");
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
export async function removeScannedBottle(id) {
  const bottle = await prisma.bottle.delete({ where: { id } });
  revalidatePath(pathForStatus(bottle.status));
}

export async function addTastingNote(bottleId, formData) {
  const note = String(formData.get("note") || "").trim();
  if (!note) return;
  const rating = parseOptionalRating(formData.get("rating"));

  await prisma.tastingNote.create({ data: { bottleId, note, rating } });
  revalidatePath(`/bottles/${bottleId}`);
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
        "The specific bottling, if this producer is known to make more than one wine from the same grape/vintage - a vineyard designation (e.g. 'Rochioli Vineyard', 'Kanzler Vineyard') or a proprietary/cuvée name (e.g. 'Madeleine', 'Reserve', 'Insignia'). This is what a producer prints to distinguish this specific wine from their other bottlings of the same variety - use your knowledge of the producer's lineup, not just what's printed, since it may not be obvious which of a producer's several similarly-labeled wines this is without checking. Null if this producer only makes one bottling of this grape, or there's no such distinguishing name.",
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
        "Start of the drinking window (a year), if the label/sheet states one outright, or you have a genuinely confident basis to estimate one from the wine's style/structure and vintage. Null rather than a speculative guess - most wines shouldn't get one.",
    },
    drinkTo: {
      type: ["integer", "null"],
      description: "End of the drinking window (a year), same standard as drinkFrom.",
    },
    note: {
      type: ["string", "null"],
      description:
        "Only when the source document itself includes descriptive/tasting-note-style text for this wine (e.g. a shop's tasting sheet or menu write-up) - that text, lightly cleaned up but not rewritten or embellished. Null for a plain bottle label with no such text - never invent tasting notes that aren't in the photo.",
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

const LABEL_SYSTEM_PROMPT =
  "You read wine photos for a personal cellar-tracking app. A photo is usually a single bottle label, but may instead be a document listing several wines - a shop's tasting sheet, a menu, a price list - in which case treat each distinct wine as its own entry. Extract what's stated, and use your wine knowledge to fill in what's implied but not stated outright (grape variety from an appellation's convention, broader geography from a narrow appellation). Many producers make several distinct wines from the same grape and vintage - a regional/estate bottling plus one or more vineyard-designated or proprietary-named bottlings (e.g. a producer's basic Pinot Noir alongside a 'Rochioli Vineyard' or a 'Madeleine' bottling). Think about whether this producer is one of those before settling on the `bottling` field - a label that only shows a small or partial vineyard/cuvée name (easy to crop out of a photo, or in small print) is exactly the kind of detail worth getting right, since it's what tells two of a producer's own bottlings apart. If the source document includes its own descriptive/tasting-note-style text for a wine, carry that into the entry's `note` field - never invent one for a plain label with no such text. You may call search_cellar first to check whether this user already logged a given producer/region with fuller details - use that as a grounding signal, not a guarantee, since it's the user's own inventory, not a verified reference. Call record_wines exactly once, when you're done with every wine in the photo, with your best final answer.";

// Reads a photo - one bottle label, or a document listing several wines -
// optionally researching the user's own saved bottles and the model's wine
// knowledge along the way, and saves each wine found as a real bottle
// right away (see the save loop below for why), returning the saved
// records for the scan flow to show as editable review cards. Each
// result is either { bottle } on success, or { wine, saveError: true } if
// reading succeeded but that one wine's save didn't.
export async function extractWinesFromPhoto(base64Image, mediaType) {
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
        model: "claude-opus-5",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        system: LABEL_SYSTEM_PROMPT,
        tools: [SEARCH_CELLAR_TOOL, WINES_TOOL],
        messages,
      });

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
          const status = wine.note ? "consumed" : "inventory";
          try {
            const bottle = await prisma.bottle.create({
              data: {
                ...bottleDataFromWine(wine),
                status,
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
    "Browse this user's current inventory - bottles they actually own and could open tonight, not their wishlist or already-consumed bottles - to find candidates for a pairing or tasting recommendation. Call this one or more times with different filters to explore what's actually available (e.g. once for reds, once for whites) rather than assuming what's there. Returns each matching bottle's id (needed to reference it in your final answer), producer, bottling, vintage, type, variety, region, country, quantity, average personal rating if any exists, and drinkFrom/drinkTo (its drinking window, if known - null fields mean no window is recorded, not that it's unready). Results are capped, so use filters if the cellar is large.",
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
      summary: {
        type: "string",
        description: "A short (1-3 sentence) overall explanation of your recommendation or theme.",
      },
      picks: {
        type: "array",
        description: "One entry per recommended wine.",
        items: SUGGESTION_PICK_SCHEMA,
      },
    },
    required: ["mode", "summary", "picks"],
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

  return matches.slice(0, 40).map((bottle) => ({
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
  }));
}

function buildSuggestSystemPrompt(currentYear) {
  return `You help a home wine collector decide what to open, in one of two ways: PAIRING (they describe a meal or dish, possibly with multiple courses - recommend one or more wines from their own cellar for it) or TASTING (they describe a theme, goal, or mood - build an ordered flight of wines from their cellar exploring it). Infer which one from their request. Use browse_cellar (repeatedly, with different filters, rather than assuming what's there) to find real candidates from their actual current inventory - never invent a bottle they don't have. The current year is ${currentYear} - browse_cellar returns each bottle's drinkFrom/drinkTo drinking window where one is recorded (null means none is recorded, not that it's unready). Prefer a bottle whose window (if any) includes ${currentYear}; avoid one that's too young (${currentYear} < drinkFrom) or past peak (${currentYear} > drinkTo) unless nothing better fits, in which case say so plainly in your reasoning for that pick rather than silently ignoring it. If nothing currently owned is a strong match, say so honestly and propose a specific gap suggestion (a real producer/style/region, not a vague category) worth adding to their wishlist, rather than forcing a mediocre owned bottle into the recommendation. For a tasting flight, order picks in the sequence they should be tasted (typically lightest/driest to fullest/sweetest, or whatever logic fits the theme) and explain that ordering in the summary. Call record_suggestions exactly once, when you're done, with your final answer.`;
}

// Turns a freeform request (a meal to pair, or a tasting theme/mood) into
// wine recommendations - grounded in the user's actual current inventory
// via browse_cellar, with gap suggestions (not owned, worth adding to the
// wishlist) where nothing owned fits well. Bottle data for owned picks is
// re-fetched fresh from the database rather than trusting the model's
// echoed fields, so what's displayed always matches what's actually saved.
export async function getSuggestions(request) {
  const text = String(request || "").trim();
  if (!text) return { error: "Describe what you're working with first." };

  const messages = [{ role: "user", content: text }];
  const systemPrompt = buildSuggestSystemPrompt(new Date().getFullYear());

  try {
    // Bounded to a few turns: normally some browse_cellar calls (possibly
    // several in parallel, exploring different filters) then
    // record_suggestions, but this caps it in case the model keeps browsing.
    for (let turn = 0; turn < 6; turn++) {
      const response = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        system: systemPrompt,
        tools: [BROWSE_CELLAR_TOOL, SUGGESTIONS_TOOL],
        messages,
      });

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
          data: { mode: finalCall.input.mode, summary: finalCall.input.summary, picks: resolvedPicks },
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
        description: "Start of the drinking window (a year), only if genuinely well-supported.",
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
      ? `Drinking window: ${bottle.drinkFrom ?? "?"}–${bottle.drinkTo ?? "?"}`
      : null,
    bottle.criticNotes ? `Existing critic/winemaker notes on file: ${bottle.criticNotes}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

// Researches one already-saved bottle with a real web search (not just the
// model's training knowledge) and returns proposed field values plus an
// explanation and sources - never saved automatically. The bottle page
// shows this as an editable, prefilled form the user reviews before saving,
// same trust model as the scan and suggest features.
export async function researchBottle(id) {
  const bottle = await prisma.bottle.findUnique({ where: { id } });
  if (!bottle) return { error: "That bottle no longer exists." };

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
        model: "claude-opus-5",
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        system: RESEARCH_SYSTEM_PROMPT,
        tools: [WEB_SEARCH_TOOL, RESEARCH_TOOL],
        messages,
      });

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

// Applies reviewed/edited research output to the bottle and clears the
// research flag - a dedicated action (rather than routing through
// updateBottle) so a plain details-page edit never clears the flag as a
// side effect.
export async function applyResearch(id, prevState, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return { error: "Producer is required." };

  try {
    const existing = await prisma.bottle.findUnique({
      where: { id },
      select: { drinkFrom: true, drinkTo: true },
    });
    const bottle = await prisma.bottle.update({
      where: { id },
      data: { ...clearEstimatedFlagIfWindowChanged(data, existing), needsResearch: false },
    });
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
// existing details are judged fine as-is.
export async function dismissResearch(id) {
  await prisma.bottle.update({ where: { id }, data: { needsResearch: false } });
  revalidatePath(`/bottles/${id}`);
  revalidatePath("/research");
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
  "You estimate drinking windows (the year range a wine is expected to be at its best) for a batch of wines already in a personal cellar, using your general knowledge of the producer, variety, region, and vintage - not a web search. This is a bulk backfill for wines with no window on file at all, so bias toward giving a genuine best estimate rather than null - a rough estimate the owner can refine later is far more useful than a blank field. Call record_drink_window_estimates exactly once with one entry per wine listed, in the same order, echoing back each id.";

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
    select: {
      id: true,
      producer: true,
      bottling: true,
      vintage: true,
      type: true,
      variety: true,
      region: true,
      subRegion: true,
      country: true,
    },
  });
  if (bottles.length === 0) return { data: { updated: 0, total: 0 } };

  const listText = bottles
    .map((bottle) => `id ${bottle.id}: ${describeBottleForWindowEstimate(bottle)}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      system: DRINK_WINDOW_SYSTEM_PROMPT,
      tools: [DRINK_WINDOW_ESTIMATE_TOOL],
      messages: [
        {
          role: "user",
          content: `Estimate a drinking window for each of these wines:\n\n${listText}`,
        },
      ],
    });

    const finalCall = response.content.find(
      (block) => block.type === "tool_use" && block.name === "record_drink_window_estimates"
    );
    if (!finalCall) return { error: "Couldn't estimate that batch. Please try again." };

    let updated = 0;
    for (const estimate of finalCall.input.estimates) {
      if (estimate.drinkFrom == null && estimate.drinkTo == null) continue;
      try {
        await prisma.bottle.update({
          where: { id: estimate.id },
          data: {
            drinkFrom: estimate.drinkFrom,
            drinkTo: estimate.drinkTo,
            drinkWindowEstimated: true,
          },
        });
        updated++;
      } catch (err) {
        // One bad id in a batch (e.g. a bottle deleted mid-run) shouldn't
        // fail the rest of the batch's otherwise-good estimates.
        console.error(`Failed to apply drink window estimate for bottle ${estimate.id}:`, err);
      }
    }
    revalidatePath("/inventory");
    return { data: { updated, total: bottles.length } };
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
      model: "claude-opus-5",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: PHOTO_DETAILS_SYSTEM_PROMPT,
      tools: [PHOTO_DETAILS_TOOL],
      messages,
    });

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
export async function saveTastingFlight(summary, picks) {
  const ownedPicks = picks.filter((p) => Number.isInteger(p.bottleId));
  if (ownedPicks.length === 0) return { error: "Nothing in that flight was an owned bottle to save." };

  const flight = await prisma.tastingFlight.create({
    data: {
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

export async function markFlightPickConsumed(pickId) {
  const pick = await prisma.flightPick.update({
    where: { id: pickId },
    data: { consumed: true },
  });
  revalidatePath(`/flights/${pick.flightId}`);
  revalidatePath("/flights");
}

export async function deleteTastingFlight(id) {
  await prisma.tastingFlight.delete({ where: { id } });
  revalidatePath("/flights");
  redirect("/flights");
}
