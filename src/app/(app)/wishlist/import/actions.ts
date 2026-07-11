"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseDeckList } from "@/lib/deck-parser";
import { resolveCardsBySetCollector, setCollectorKey } from "@/lib/card-resolver";

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

  const idMap = await resolveCardsBySetCollector(deckRows);
  const resolvedIds = Array.from(new Set(idMap.values()));

  const cards =
    resolvedIds.length > 0
      ? await prisma.card.findMany({
          where: { id: { in: resolvedIds } },
          select: { id: true, name: true, setCode: true, collectorNumber: true, imageSmall: true },
        })
      : [];
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const ownedAgg =
    resolvedIds.length > 0
      ? await prisma.collectionItem.groupBy({
          by: ["cardId"],
          where: { userId: user.id, cardId: { in: resolvedIds } },
          _sum: { quantity: true },
        })
      : [];
  const ownedMap = new Map(ownedAgg.map((o) => [o.cardId, o._sum.quantity ?? 0]));

  let matched = 0;
  let missing = 0;
  let alreadyOwned = 0;
  let toAdd = 0;

  const previewRows: PreviewRow[] = deckRows.map((dr) => {
    const cardId = idMap.get(setCollectorKey(dr.setCode, dr.collectorNumber)) ?? null;
    const card = cardId ? cardMap.get(cardId) : null;

    if (!card) {
      missing++;
      return {
        name: dr.name,
        setCode: dr.setCode,
        collectorNumber: dr.collectorNumber,
        quantity: dr.quantity,
        scryfallId: null,
        imageSmall: null,
        owned: 0,
        needed: dr.quantity,
        matched: false,
      };
    }

    matched++;
    const owned = ownedMap.get(card.id) ?? 0;
    const needed = Math.max(0, dr.quantity - owned);
    if (needed > 0) toAdd++;
    else alreadyOwned++;

    return {
      name: card.name,
      setCode: card.setCode,
      collectorNumber: card.collectorNumber,
      quantity: dr.quantity,
      scryfallId: card.id,
      imageSmall: card.imageSmall,
      owned,
      needed,
      matched: true,
    };
  });

  return {
    ok: true,
    rows: previewRows,
    errors,
    counts: { total: deckRows.length, matched, missing, alreadyOwned, toAdd },
  };
}

export type DeckApplyResult = { ok: true; added: number; skipped: number } | { ok: false; error: string };

const applySchema = z.object({
  tag: z.string().max(60).optional(),
  rows: z
    .array(
      z.object({
        scryfallId: z.string().min(1),
        needed: z.number().int().min(1).max(99),
      }),
    )
    .max(1000),
});

export async function applyDeckImport(payload: string): Promise<DeckApplyResult> {
  const user = await requireUser();

  let data: z.infer<typeof applySchema>;
  try {
    data = applySchema.parse(JSON.parse(payload));
  } catch {
    return { ok: false, error: "Invalid payload" };
  }

  const tagValue = data.tag?.trim() || null;
  let added = 0;
  let skipped = 0;

  await prisma.$transaction(
    async (tx) => {
      for (const r of data.rows) {
        if (r.needed <= 0) {
          skipped++;
          continue;
        }

        await tx.wishlistItem.upsert({
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
    },
    { timeout: 30000 },
  );

  revalidatePath("/wishlist");
  return { ok: true, added, skipped };
}
