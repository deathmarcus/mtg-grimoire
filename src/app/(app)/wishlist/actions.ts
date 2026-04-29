"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { logActivity } from "@/lib/activity";

const addSchema = z.object({
  cardId: z.string().min(1),
  quantityWanted: z.coerce.number().int().min(1).max(9999).default(1),
  maxPriceUsd: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  tag: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export async function addWishlistItem(formData: FormData) {
  const user = await requireUser();
  const parsed = addSchema.safeParse({
    cardId: formData.get("cardId"),
    quantityWanted: formData.get("quantityWanted") ?? 1,
    maxPriceUsd: formData.get("maxPriceUsd") || "",
    priority: formData.get("priority") ?? "MEDIUM",
    tag: formData.get("tag") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const d = parsed.data;
  const priceValue = typeof d.maxPriceUsd === "number" ? d.maxPriceUsd : null;
  const tagValue = d.tag?.trim() || null;

  await prisma.wishlistItem.upsert({
    where: {
      userId_cardId: { userId: user.id, cardId: d.cardId },
    },
    create: {
      userId: user.id,
      cardId: d.cardId,
      quantityWanted: d.quantityWanted,
      maxPriceUsd: priceValue,
      priority: d.priority,
      tag: tagValue,
      notes: d.notes ?? null,
    },
    update: {
      quantityWanted: { increment: d.quantityWanted },
    },
  });

  const card = await prisma.card.findUnique({
    where: { id: d.cardId },
    select: { name: true },
  });
  await logActivity(user.id, "wishlist_add", {
    cardId: d.cardId,
    cardName: card?.name ?? "Unknown card",
    quantityWanted: d.quantityWanted,
  });

  revalidatePath("/wishlist");
  revalidatePath("/dashboard");
  return { ok: true };
}

const updateSchema = z.object({
  quantityWanted: z.coerce.number().int().min(1).max(9999),
  maxPriceUsd: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  tag: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export async function updateWishlistItem(itemId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = updateSchema.safeParse({
    quantityWanted: formData.get("quantityWanted"),
    maxPriceUsd: formData.get("maxPriceUsd") || "",
    priority: formData.get("priority"),
    tag: formData.get("tag") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const d = parsed.data;
  const priceValue = typeof d.maxPriceUsd === "number" ? d.maxPriceUsd : null;
  const tagValue = d.tag?.trim() || null;

  await prisma.wishlistItem.updateMany({
    where: { id: itemId, userId: user.id },
    data: {
      quantityWanted: d.quantityWanted,
      maxPriceUsd: priceValue,
      priority: d.priority,
      tag: tagValue,
      notes: d.notes ?? null,
    },
  });

  revalidatePath("/wishlist");
  revalidatePath(`/wishlist/${itemId}`);
  return { ok: true };
}

export async function deleteWishlistItem(itemId: string) {
  const user = await requireUser();
  await prisma.wishlistItem.deleteMany({
    where: { id: itemId, userId: user.id },
  });
  revalidatePath("/wishlist");
}
