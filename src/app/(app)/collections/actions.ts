"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { validateCollectionName } from "@/lib/collection-helpers";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

export async function createCollection(formData: FormData): Promise<CreateResult> {
  const user = await requireUser();
  const raw = String(formData.get("name") ?? "");
  const validation = validateCollectionName(raw);
  if (!validation.ok) return { ok: false, error: validation.error };

  const existing = await prisma.collection.findUnique({
    where: { userId_name: { userId: user.id, name: validation.value } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "Ya existe una colección con ese nombre" };

  const max = await prisma.collection.aggregate({
    where: { userId: user.id },
    _max: { sortOrder: true },
  });
  const created = await prisma.collection.create({
    data: {
      userId: user.id,
      name: validation.value,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
    select: { id: true, name: true },
  });
  revalidatePath("/collections");
  revalidatePath("/collection");
  revalidatePath("/import");
  return { ok: true, id: created.id, name: created.name };
}

export async function renameCollection(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("name") ?? "");
  const validation = validateCollectionName(raw);
  if (!validation.ok) return { ok: false, error: validation.error };

  const target = await prisma.collection.findFirst({
    where: { id, userId: user.id },
    select: { id: true, name: true },
  });
  if (!target) return { ok: false, error: "Colección no encontrada" };
  if (target.name === validation.value) return { ok: true };

  const clash = await prisma.collection.findUnique({
    where: { userId_name: { userId: user.id, name: validation.value } },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "Ya existe una colección con ese nombre" };

  await prisma.collection.update({
    where: { id },
    data: { name: validation.value },
  });
  revalidatePath("/collections");
  revalidatePath("/collection");
  return { ok: true };
}

export async function deleteCollection(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const target = await prisma.collection.findFirst({
    where: { id, userId: user.id },
    select: { id: true, isDefault: true },
  });
  if (!target) return { ok: false, error: "Colección no encontrada" };
  if (target.isDefault) return { ok: false, error: "No puedes borrar la colección por defecto" };

  const def = await prisma.collection.findFirst({
    where: { userId: user.id, isDefault: true },
    select: { id: true },
  });
  if (!def) return { ok: false, error: "No hay colección por defecto" };

  await prisma.$transaction(async (tx) => {
    // Move items: if the same (cardId, foil, language, condition) already
    // exists in the default collection, merge quantities and drop the origin
    // row. Otherwise reassign collectionId.
    const items = await tx.collectionItem.findMany({
      where: { collectionId: id, userId: user.id },
      select: {
        id: true,
        cardId: true,
        foil: true,
        language: true,
        condition: true,
        quantity: true,
      },
    });
    for (const it of items) {
      const clash = await tx.collectionItem.findUnique({
        where: {
          userId_collectionId_cardId_foil_language_condition: {
            userId: user.id,
            collectionId: def.id,
            cardId: it.cardId,
            foil: it.foil,
            language: it.language,
            condition: it.condition,
          },
        },
        select: { id: true },
      });
      if (clash) {
        await tx.collectionItem.update({
          where: { id: clash.id },
          data: { quantity: { increment: it.quantity } },
        });
        await tx.collectionItem.delete({ where: { id: it.id } });
      } else {
        await tx.collectionItem.update({
          where: { id: it.id },
          data: { collectionId: def.id },
        });
      }
    }
    await tx.collection.delete({ where: { id } });
  });

  revalidatePath("/collections");
  revalidatePath("/collection");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function reorderCollection(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const user = await requireUser();
  const all = await prisma.collection.findMany({
    where: { userId: user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, sortOrder: true },
  });
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: "Colección no encontrada" };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= all.length) return { ok: true };

  const a = all[idx];
  const b = all[swapIdx];
  await prisma.$transaction([
    prisma.collection.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.collection.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
  // If both had the same sortOrder (legacy seed) nudge to ensure distinct values.
  if (a.sortOrder === b.sortOrder) {
    await prisma.collection.update({
      where: { id: direction === "up" ? a.id : b.id },
      data: { sortOrder: a.sortOrder - 1 },
    });
  }
  revalidatePath("/collections");
  revalidatePath("/collection");
  return { ok: true };
}

export async function toggleExcludeFromTotals(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const target = await prisma.collection.findFirst({
    where: { id, userId: user.id },
    select: { id: true, excludeFromTotals: true },
  });
  if (!target) return { ok: false, error: "Colección no encontrada" };
  await prisma.collection.update({
    where: { id },
    data: { excludeFromTotals: !target.excludeFromTotals },
  });
  revalidatePath("/collections");
  revalidatePath("/dashboard");
  return { ok: true };
}
