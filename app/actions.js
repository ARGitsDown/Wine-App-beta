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

function bottleDataFromForm(formData) {
  return {
    producer: String(formData.get("producer") || "").trim(),
    vintage: parseOptionalInt(formData.get("vintage")),
    variety: String(formData.get("variety") || "").trim() || null,
    region: String(formData.get("region") || "").trim() || null,
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
  return prisma.bottle.create({ data: { ...data, status } });
}

export async function createBottle(status, formData) {
  const bottle = await insertBottle(status, formData);
  if (bottle) revalidatePath(pathForStatus(status));
}

// Used by the label-scanning flow so a successful save takes the user to
// their inventory/wishlist (where the new bottle is visible), the same way
// deleteBottle already does after a delete.
export async function createBottleFromScan(status, formData) {
  const bottle = await insertBottle(status, formData);
  if (!bottle) return;
  revalidatePath(pathForStatus(status));
  redirect(pathForStatus(status));
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
  const rating = Number(formData.get("rating"));
  if (!note || !Number.isInteger(rating) || rating < 1 || rating > 5) return;

  await prisma.tastingNote.create({ data: { bottleId, note, rating } });
  revalidatePath(`/bottles/${bottleId}`);
}

const SEARCH_CELLAR_TOOL = {
  name: "search_cellar",
  description:
    "Search this user's own already-saved bottles by producer name or region/appellation. Use this to check whether the same or a similar wine was logged before with fuller details than the current photo shows - e.g. a producer whose label doesn't print its grape variety, but whose variety is already known from an earlier bottle.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Producer name or region/appellation to search for.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  strict: true,
};

const WINE_LABEL_TOOL = {
  name: "record_wine_label",
  description:
    "Record the final, best-available wine details for this bottle, after reading the label and doing any research needed.",
  input_schema: {
    type: "object",
    properties: {
      producer: {
        type: "string",
        description: "The producer/winery name as printed on the label.",
      },
      vintage: {
        type: ["integer", "null"],
        description: "The vintage year, or null if non-vintage/not visible.",
      },
      variety: {
        type: ["string", "null"],
        description:
          "Grape variety or blend. Many Old World wines (red/white Bordeaux, red/white Burgundy, Chianti, Barolo, Rioja, etc.) print only the region, not the grape - in that case, infer the conventional grape(s) for that appellation from your knowledge (e.g. red Bordeaux -> a Cabernet Sauvignon/Merlot blend, red Burgundy -> Pinot Noir, white Burgundy -> Chardonnay, Barolo -> Nebbiolo) and prefix the value with 'Likely ' since it wasn't printed on the label. Null only if you have no reasonable basis to infer it.",
      },
      region: {
        type: ["string", "null"],
        description:
          "Region/appellation as printed on the label, extended with the broader geography that helps place it - append the country, and the US state if applicable, e.g. 'Margaux, Bordeaux, France' or 'Napa Valley, California, USA'. Infer the broader geography from your knowledge even when only the narrow appellation is printed.",
      },
      confident: {
        type: "boolean",
        description:
          "True only if you're confident in every field above, including any inferred ones. False if you had to guess at something uncertain - the user will double check fields when this is false.",
      },
    },
    required: ["producer", "vintage", "variety", "region", "confident"],
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
      ],
    },
    select: { producer: true, vintage: true, variety: true, region: true },
    take: 5,
  });
}

const LABEL_SYSTEM_PROMPT =
  "You read wine label photos for a personal cellar-tracking app. Extract what's printed, and use your wine knowledge to fill in what's implied but not printed (grape variety from an appellation's convention, broader geography from a narrow appellation). You may call search_cellar first to check whether this user already logged the same producer/region with fuller details - use that as a grounding signal, not a guarantee, since it's the user's own inventory, not a verified reference. Call record_wine_label exactly once, when you're done, with your best final answer.";

// Reads a wine label photo - optionally researching the user's own saved
// bottles and the model's wine knowledge along the way - and returns
// structured fields for the scan-a-label flow to prefill an editable
// add-bottle form with. The user still reviews and confirms before anything
// is saved.
export async function extractBottleFromLabel(base64Image, mediaType) {
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
          text: "Read the wine label in this photo and record its details.",
        },
      ],
    },
  ];

  try {
    // Bounded to a few turns: normally one search_cellar call (if any) then
    // record_wine_label, but this caps it in case the model keeps searching.
    for (let turn = 0; turn < 4; turn++) {
      const response = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: LABEL_SYSTEM_PROMPT,
        tools: [SEARCH_CELLAR_TOOL, WINE_LABEL_TOOL],
        messages,
      });

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      const finalCall = toolUses.find((t) => t.name === "record_wine_label");
      if (finalCall) {
        return { data: finalCall.input };
      }

      const searchCall = toolUses.find((t) => t.name === "search_cellar");
      if (!searchCall) {
        return { error: "Could not read that label. Try a clearer, well-lit photo." };
      }

      const results = await searchCellar(searchCall.input.query);
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: searchCall.id,
            content: JSON.stringify(results),
          },
        ],
      });
    }
    return { error: "Could not read that label. Try a clearer, well-lit photo." };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { error: "The label reader isn't configured correctly (invalid API key)." };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { error: "Too many photos at once — wait a moment and try again." };
    }
    if (err instanceof Anthropic.APIError) {
      return { error: `Label reader error: ${err.message}` };
    }
    return {
      error: "Something went wrong reading that photo. Please try again or enter the details manually.",
    };
  }
}
