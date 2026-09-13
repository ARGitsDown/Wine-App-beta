"use server";

import { prisma } from "@/lib/prisma";
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

export async function createBottle(status, formData) {
  const data = bottleDataFromForm(formData);
  if (!data.producer) return;

  await prisma.bottle.create({ data: { ...data, status } });
  revalidatePath(pathForStatus(status));
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
