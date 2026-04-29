"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseDeckList, type DeckRow } from "@/lib/deck-parser";

export type PreviewRow = {
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  scryfallId: string | null;
  imageSmall: string | null;
  owned: number;
  needed: number;
  matched: boolean;
};

export type DeckPreviewResult =
  | { ok: true; rows: PreviewRow[]; errors: string[]; counts: { total: number; matched: number; missing: number; alreadyOwned: number; toAdd: number } }
  | { ok: false; error: string };

export async function previewDeckImport(text: string): Promise<DeckPreviewResult> {
  const user = await requireUser();
  const { rows: deckRows, errors } = parseDeckList(text);

  if (deckRows.length === 0) {
    return { ok: false, error: errors.length > 0 ? errors[0] : "No cards found in input" };
  }

  const previewRows: PreviewRow[] = [];
  let matched = 0;
  let missing = 0;
  let alreadyOwned = 0;
  let toAdd = 0;

  for (const dr of deckRows) {
    const card = await findCard(dr);
    if (!card) {
      missing++;
      previewRows.push({
        name: dr.name,
        setCode: dr.setCode,
        collectorNumber: dr.collectorNumber,
        quantity: dr.quantity,
        scryfallId: null,
        imageSmall: null,
        owned: 0,
        needed: dr.quantity,
        matched: false,
      });
      continue;
    }

    matched++;
    const ownedAgg = await prisma.collectionItem.aggregate({
      where: { userId: user.id, cardId: card.id },
      _sum: { quantity: true },
    });
    const owned = ownedAgg._sum.quantity ?? 0;
    const needed = Math.max(0, dr.quantity - owned);

    if (needed > 0) toAdd++;
    else alreadyOwned++;

    previewRows.push({
      name: card.name,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      quantity: dr.quantity,
      scryfallId: card.id,
      imageSmall: card.imageSmall,
      owned,
      needed,
      matched: true,
    });
  }

  return {
    ok: true,
    rows: previewRows,
    errors,
    counts: { total: deckRows.length, matched, missing, alreadyOwned, toAdd },
  };
}

async function findCard(dr: DeckRow) {
  const exact = await prisma.card.findFirst({
    where: { setCode: dr.setCode, collectorNumber: dr.collectorNumber, name: { contains: dr.name, mode: "insensitive" } },
    select: { id: true, name: true, setCode: true, collectorNumber: true, imageSmall: true },
  });
  if (exact) return exact;

  const bySetName = await prisma.card.findFirst({
    where: { setCode: dr.setCode, name: { contains: dr.name, mode: "insensitive" } },
    select: { id: true, name: true, setCode: true, collectorNumber: true, imageSmall: true },
  });
  return bySetName ?? null;
}

export type DeckApplyResult = { ok: true; added: number; skipped: number } | { ok: false; error: string };

export async function applyDeckImport(payload: string): Promise<DeckApplyResult> {
  const user = await requireUser();

  let data: { tag: string; rows: { scryfallId: string; needed: number }[] };
  try {
    data = JSON.parse(payload);
  } catch {
    return { ok: false, error: "Invalid payload" };
  }

  const tagValue = data.tag?.trim() || null;
  let added = 0;
  let skipped = 0;

  for (const r of data.rows) {
    if (r.needed <= 0) {
      skipped++;
      continue;
    }

    await prisma.wishlistItem.upsert({
      where: { userId_cardId: { userId: user.id, cardId: r.scryfallId } },
      create: {
        userId: user.id,
        cardId: r.scryfallId,
        quantityWanted: r.needed,
        tag: tagValue,
      },
      update: {
        quantityWanted: { increment: r.needed },
      },
    });
    added++;
  }

  revalidatePath("/wishlist");
  return { ok: true, added, skipped };
}
