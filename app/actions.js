"use server";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseOptionalRating(value) {
  const n = parseOptionalInt(value);
  return n !== null && n >= 1 && n <= 5 ? n : null;
}

function bottleDataFromForm(formData) {
  return {
    producer: String(formData.get("producer") || "").trim(),
    vintage: parseOptionalInt(formData.get("vintage")),
    type: String(formData.get("type") || "").trim() || null,
    variety: String(formData.get("variety") || "").trim() || null,
    region: String(formData.get("region") || "").trim() || null,
    country: String(formData.get("country") || "").trim() || null,
    quantity: Math.max(1, parseOptionalInt(formData.get("quantity")) || 1),
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

function pathForStatus(status) {
  if (status === "inventory") return "/inventory";
  if (status === "consumed") return "/consumed";
  return "/wishlist";
}

async function insertBottle(status, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return null;
  try {
    return await prisma.bottle.create({ data: { ...data, status } });
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

export async function createBottle(status, formData) {
  const bottle = await insertBottle(status, formData);
  if (bottle) revalidatePath(pathForStatus(status));
}

// Used by the scan flow, where every card offers an optional tasting note
// alongside the usual bottle fields (e.g. a shop tasting sheet's own
// write-up, prefilled for the user to edit or add their own rating to).
export async function createBottleWithNote(status, formData) {
  const bottle = await insertBottle(status, formData);
  if (!bottle) return;

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
}

export async function updateBottle(id, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return;

  const bottle = await prisma.bottle.update({ where: { id }, data });
  revalidatePath(`/bottles/${id}`);
  revalidatePath(pathForStatus(bottle.status));
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
        "The primary sub-country identifier: for a US wine, the state (e.g. 'California', 'Oregon'); for anywhere else, the named wine region or appellation (e.g. 'Bordeaux', 'Burgundy', 'Central Otago', 'Burgenland'). Use your knowledge to fill this in even when only a narrower appellation is stated (e.g. 'Margaux' implies the region 'Bordeaux'). Do not include the country here - that's a separate field.",
    },
    country: {
      type: ["string", "null"],
      description:
        "Country of origin, inferred from your knowledge when not stated outright (e.g. a Margaux wine implies France).",
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
    "vintage",
    "type",
    "variety",
    "region",
    "country",
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
        { region: { contains: q, mode: "insensitive" } },
        { country: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      producer: true,
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
  "You read wine photos for a personal cellar-tracking app. A photo is usually a single bottle label, but may instead be a document listing several wines - a shop's tasting sheet, a menu, a price list - in which case treat each distinct wine as its own entry. Extract what's stated, and use your wine knowledge to fill in what's implied but not stated outright (grape variety from an appellation's convention, broader geography from a narrow appellation). If the source document includes its own descriptive/tasting-note-style text for a wine, carry that into the entry's `note` field - never invent one for a plain label with no such text. You may call search_cellar first to check whether this user already logged a given producer/region with fuller details - use that as a grounding signal, not a guarantee, since it's the user's own inventory, not a verified reference. Call record_wines exactly once, when you're done with every wine in the photo, with your best final answer.";

// Reads a photo - one bottle label, or a document listing several wines -
// optionally researching the user's own saved bottles and the model's wine
// knowledge along the way, and returns a structured entry per wine found,
// for the scan flow to prefill an editable add-bottle form per entry. The
// user still reviews and confirms before anything is saved.
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
        return { data: finalCall.input.wines };
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
