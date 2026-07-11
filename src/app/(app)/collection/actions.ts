"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireOwnedCollectionId } from "@/lib/collections";
import { logActivity } from "@/lib/activity";
import { planBulkEdit, type BulkItemSnapshot, type ExistingItem } from "@/lib/bulk-edit";

const addSchema = z.object({
  cardId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(9999),
  foil: z.enum(["NORMAL", "FOIL", "ETCHED"]).default("NORMAL"),
  language: z.string().trim().min(2).max(8).default("en"),
  condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]).default("NM"),
  notes: z.string().max(500).optional(),
});

export async function addCollectionItem(formData: FormData) {
  const user = await requireUser();
  const parsed = addSchema.safeParse({
    cardId: formData.get("cardId"),
    quantity: formData.get("quantity"),
    foil: formData.get("foil") ?? "NORMAL",
    language: formData.get("language") ?? "en",
    condition: formData.get("condition") ?? "NM",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const rawCollectionId = formData.get("collectionId");
  const collectionId = await requireOwnedCollectionId(
    user.id,
    typeof rawCollectionId === "string" ? rawCollectionId : null,
  );
  if (!collectionId) return { error: "Invalid collection" };

  await prisma.collectionItem.upsert({
    where: {
      userId_collectionId_cardId_foil_language_condition: {
        userId: user.id,
        collectionId,
        cardId: parsed.data.cardId,
        foil: parsed.data.foil,
        language: parsed.data.language,
        condition: parsed.data.condition,
      },
    },
    create: {
      userId: user.id,
      collectionId,
      cardId: parsed.data.cardId,
      quantity: parsed.data.quantity,
      foil: parsed.data.foil,
      language: parsed.data.language,
      condition: parsed.data.condition,
      notes: parsed.data.notes,
    },
    update: {
      quantity: { increment: parsed.data.quantity },
      notes: parsed.data.notes,
    },
  });

  const card = await prisma.card.findUnique({
    where: { id: parsed.data.cardId },
    select: { name: true },
  });
  await logActivity(user.id, "add", {
    cardId: parsed.data.cardId,
    cardName: card?.name ?? "Unknown card",
    quantity: parsed.data.quantity,
    foil: parsed.data.foil,
  });

  revalidatePath("/collection");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteCollectionItem(itemId: string) {
  const user = await requireUser();
  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    select: {
      userId: true,
      cardId: true,
      quantity: true,
      card: { select: { name: true } },
    },
  });
  if (!item || item.userId !== user.id) return;
  await prisma.collectionItem.delete({ where: { id: itemId } });
  await logActivity(user.id, "delete", {
    cardId: item.cardId,
    cardName: item.card.name,
    quantity: item.quantity,
  });
  revalidatePath("/collection");
  revalidatePath("/dashboard");
}

const quantitySchema = z.coerce.number().int().min(1).max(9999);

export async function updateItemQuantity(itemId: string, quantity: number) {
  const user = await requireUser();
  const parsed = quantitySchema.safeParse(quantity);
  if (!parsed.success) return { error: "Invalid quantity" };
  await prisma.collectionItem.updateMany({
    where: { id: itemId, userId: user.id },
    data: { quantity: parsed.data },
  });
  revalidatePath("/collection");
  revalidatePath(`/collection/${itemId}`);
  revalidatePath("/dashboard");
}

const editSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(9999),
  foil: z.enum(["NORMAL", "FOIL", "ETCHED"]),
  language: z.string().trim().min(2).max(8),
  condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]),
  collectionId: z.string().min(1),
  acquiredPrice: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  notes: z.string().max(500).optional(),
});

export type EditResult =
  | { ok: true; merged: boolean; redirectTo: string }
  | { ok: false; error: string };

export async function updateCollectionItem(
  itemId: string,
  formData: FormData,
): Promise<EditResult> {
  const user = await requireUser();
  const parsed = editSchema.safeParse({
    quantity: formData.get("quantity"),
    foil: formData.get("foil"),
    language: formData.get("language"),
    condition: formData.get("condition"),
    collectionId: formData.get("collectionId"),
    acquiredPrice: formData.get("acquiredPrice") || "",
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    select: { id: true, userId: true, cardId: true },
  });
  if (!item || item.userId !== user.id) return { ok: false, error: "Not found" };

  const ownedCollectionId = await requireOwnedCollectionId(
    user.id,
    parsed.data.collectionId,
  );
  if (!ownedCollectionId) return { ok: false, error: "Invalid collection" };

  const d = parsed.data;
  const priceValue = typeof d.acquiredPrice === "number" ? d.acquiredPrice : null;

  const clash = await prisma.collectionItem.findUnique({
    where: {
      userId_collectionId_cardId_foil_language_condition: {
        userId: user.id,
        collectionId: d.collectionId,
        cardId: item.cardId,
        foil: d.foil,
        language: d.language,
        condition: d.condition,
      },
    },
    select: { id: true, quantity: true },
  });

  if (clash && clash.id !== itemId) {
    await prisma.$transaction([
      prisma.collectionItem.update({
        where: { id: clash.id },
        data: { quantity: { increment: d.quantity } },
      }),
      prisma.collectionItem.delete({ where: { id: itemId } }),
    ]);
    revalidatePath("/collection");
    revalidatePath("/dashboard");
    return { ok: true, merged: true, redirectTo: `/collection/${clash.id}` };
  }

  await prisma.collectionItem.update({
    where: { id: itemId },
    data: {
      quantity: d.quantity,
      foil: d.foil,
      language: d.language,
      condition: d.condition,
      collectionId: d.collectionId,
      acquiredPrice: priceValue,
      notes: d.notes ?? null,
    },
  });
  revalidatePath("/collection");
  revalidatePath(`/collection/${itemId}`);
  revalidatePath("/dashboard");
  return { ok: true, merged: false, redirectTo: `/collection/${itemId}` };
}

export type ReplaceResult =
  | { ok: true; merged: boolean; redirectTo: string }
  | { ok: false; error: string };

export async function replacePrinting(
  itemId: string,
  newCardId: string,
): Promise<ReplaceResult> {
  const user = await requireUser();
  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      userId: true,
      collectionId: true,
      quantity: true,
      foil: true,
      language: true,
      condition: true,
    },
  });
  if (!item || item.userId !== user.id) return { ok: false, error: "Not found" };

  const cardExists = await prisma.card.findUnique({
    where: { id: newCardId },
    select: { id: true },
  });
  if (!cardExists) return { ok: false, error: "Card not found in catalog" };

  const clash = await prisma.collectionItem.findUnique({
    where: {
      userId_collectionId_cardId_foil_language_condition: {
        userId: user.id,
        collectionId: item.collectionId,
        cardId: newCardId,
        foil: item.foil,
        language: item.language,
        condition: item.condition,
      },
    },
    select: { id: true },
  });

  if (clash && clash.id !== itemId) {
    await prisma.$transaction([
      prisma.collectionItem.update({
        where: { id: clash.id },
        data: { quantity: { increment: item.quantity } },
      }),
      prisma.collectionItem.delete({ where: { id: itemId } }),
    ]);
    revalidatePath("/collection");
    revalidatePath("/dashboard");
    return { ok: true, merged: true, redirectTo: `/collection/${clash.id}` };
  }

  await prisma.collectionItem.update({
    where: { id: itemId },
    data: { cardId: newCardId },
  });
  revalidatePath("/collection");
  revalidatePath(`/collection/${itemId}`);
  revalidatePath("/dashboard");
  return { ok: true, merged: false, redirectTo: `/collection/${itemId}` };
}

// ── Bulk edit (issue #22) ───────────────────────────────────────────────────

const bulkIdsSchema = z.array(z.string().min(1)).min(1).max(1000);

const bulkChangeSchema = z
  .object({
    collectionId: z.string().min(1).optional(),
    foil: z.enum(["NORMAL", "FOIL", "ETCHED"]).optional(),
    language: z.string().trim().min(2).max(8).optional(),
    condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]).optional(),
  })
  .refine(
    (v) =>
      v.collectionId !== undefined ||
      v.foil !== undefined ||
      v.language !== undefined ||
      v.condition !== undefined,
    { message: "No fields to update" },
  );

export type BulkChangeInput = z.infer<typeof bulkChangeSchema>;

export type BulkUpdateResult =
  | { ok: true; updated: number; merged: number }
  | { ok: false; error: string };

export async function bulkUpdateItems(
  itemIds: string[],
  change: BulkChangeInput,
): Promise<BulkUpdateResult> {
  const user = await requireUser();

  const idsParsed = bulkIdsSchema.safeParse(itemIds);
  if (!idsParsed.success) return { ok: false, error: "Invalid selection" };

  const changeParsed = bulkChangeSchema.safeParse(change);
  if (!changeParsed.success) return { ok: false, error: "No changes to apply" };
  const d = changeParsed.data;

  let targetCollectionId: string | undefined;
  if (d.collectionId !== undefined) {
    const owned = await requireOwnedCollectionId(user.id, d.collectionId);
    if (!owned) return { ok: false, error: "Invalid collection" };
    targetCollectionId = owned;
  }

  const selected = await prisma.collectionItem.findMany({
    where: { id: { in: idsParsed.data }, userId: user.id },
    select: {
      id: true,
      cardId: true,
      collectionId: true,
      foil: true,
      language: true,
      condition: true,
      quantity: true,
    },
  });
  if (selected.length === 0) return { ok: false, error: "Not found" };

  const cardIds = [...new Set(selected.map((s) => s.cardId))];
  const existing = await prisma.collectionItem.findMany({
    where: {
      userId: user.id,
      cardId: { in: cardIds },
      id: { notIn: selected.map((s) => s.id) },
    },
    select: {
      id: true,
      cardId: true,
      collectionId: true,
      foil: true,
      language: true,
      condition: true,
    },
  });

  const plan = planBulkEdit(
    selected as BulkItemSnapshot[],
    {
      collectionId: targetCollectionId,
      foil: d.foil,
      language: d.language,
      condition: d.condition,
    },
    existing as ExistingItem[],
  );

  const ops = [
    ...plan.fieldUpdates.map((op) =>
      prisma.collectionItem.update({
        where: { id: op.id },
        data: {
          collectionId: op.collectionId,
          foil: op.foil,
          language: op.language,
          condition: op.condition,
        },
      }),
    ),
    ...plan.survivorUpdates.map((op) =>
      prisma.collectionItem.update({
        where: { id: op.id },
        data: {
          collectionId: op.collectionId,
          foil: op.foil,
          language: op.language,
          condition: op.condition,
          quantity: op.quantity,
        },
      }),
    ),
    ...plan.existingIncrements.map((op) =>
      prisma.collectionItem.update({
        where: { id: op.id },
        data: { quantity: { increment: op.incrementBy } },
      }),
    ),
    ...(plan.deletedIds.length > 0
      ? [
          prisma.collectionItem.deleteMany({
            where: { id: { in: plan.deletedIds }, userId: user.id },
          }),
        ]
      : []),
  ];

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  const merged = plan.survivorUpdates.length + plan.existingIncrements.length;
  await logActivity(user.id, "bulk_update", { count: selected.length, merged });

  revalidatePath("/collection");
  revalidatePath("/dashboard");
  return { ok: true, updated: selected.length, merged };
}

export type BulkDeleteResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

export async function bulkDeleteItems(itemIds: string[]): Promise<BulkDeleteResult> {
  const user = await requireUser();

  const idsParsed = bulkIdsSchema.safeParse(itemIds);
  if (!idsParsed.success) return { ok: false, error: "Invalid selection" };

  const selected = await prisma.collectionItem.findMany({
    where: { id: { in: idsParsed.data }, userId: user.id },
    select: { id: true, quantity: true },
  });
  if (selected.length === 0) return { ok: false, error: "Not found" };

  await prisma.$transaction([
    prisma.collectionItem.deleteMany({
      where: { id: { in: selected.map((s) => s.id) }, userId: user.id },
    }),
  ]);

  const totalQuantity = selected.reduce((sum, s) => sum + s.quantity, 0);
  await logActivity(user.id, "bulk_delete", { count: selected.length, totalQuantity });

  revalidatePath("/collection");
  revalidatePath("/dashboard");
  return { ok: true, deleted: selected.length };
}
