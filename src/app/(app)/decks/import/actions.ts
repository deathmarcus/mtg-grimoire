"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { parseDeckImport } from "@/lib/deck-import-parser";
import {
  fetchJson,
  toCardRow,
  type ScryfallCard,
  SCRYFALL_API,
} from "../../../../../scripts/lib/scryfall";

// ---------------------------------------------------------------------------
// Card resolution (local DB + live Scryfall fallback)
// ---------------------------------------------------------------------------

async function resolveCardsBySetCollector(
  rows: { name: string; setCode: string; collectorNumber: string }[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const unique = Array.from(
    new Map(rows.map((r) => [`${r.setCode}|${r.collectorNumber}`, r])).values(),
  );

  // 1. Bulk lookup by (setCode, collectorNumber)
  const bySetCollector = await prisma.card.findMany({
    where: {
      OR: unique.map((r) => ({
        setCode: r.setCode.toLowerCase(),
        collectorNumber: r.collectorNumber,
      })),
    },
    select: { id: true, setCode: true, collectorNumber: true, name: true },
  });

  for (const card of bySetCollector) {
    result.set(`${card.setCode.toUpperCase()}|${card.collectorNumber}`, card.id);
  }

  // 2. Name+set fallback for still-missing rows
  const stillMissing = unique.filter(
    (r) => !result.has(`${r.setCode}|${r.collectorNumber}`),
  );

  if (stillMissing.length > 0) {
    const byName = await prisma.card.findMany({
      where: {
        OR: stillMissing.map((r) => ({
          name: { equals: r.name, mode: "insensitive" as const },
          setCode: r.setCode.toLowerCase(),
        })),
      },
      select: { id: true, setCode: true, collectorNumber: true, name: true },
    });

    for (const card of byName) {
      const nameMatch = stillMissing.find(
        (r) =>
          r.name.toLowerCase() === card.name.toLowerCase() &&
          r.setCode.toLowerCase() === card.setCode.toLowerCase() &&
          !result.has(`${r.setCode}|${r.collectorNumber}`),
      );
      if (nameMatch) {
        result.set(`${nameMatch.setCode}|${nameMatch.collectorNumber}`, card.id);
      }
    }
  }

  // 3. Live Scryfall fallback
  const afterNameFallback = unique.filter(
    (r) => !result.has(`${r.setCode}|${r.collectorNumber}`),
  );

  for (const row of afterNameFallback) {
    try {
      const url = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(row.name)}&set=${encodeURIComponent(row.setCode)}`;
      const card = await fetchJson<ScryfallCard>(url);
      const { legalities, ...rest } = toCardRow(card);
      const data = legalities == null ? rest : { ...rest, legalities };
      await prisma.card.upsert({
        where: { id: rest.id },
        create: data,
        update: data,
      });
      result.set(`${row.setCode}|${row.collectorNumber}`, rest.id);
    } catch {
      // leave as missing
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export type DeckPreviewRow = {
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  isCommander: boolean;
  board: "MAIN" | "SIDE";
  cardId: string | null;
  cardName: string | null;
  imageSmall: string | null;
  latestUsd: string | null;
  matched: boolean;
};

export type DeckPreviewResult =
  | {
      ok: true;
      rows: DeckPreviewRow[];
      parseErrors: string[];
      detectedCommanderName: string | null;
      counts: { total: number; found: number; notFound: number };
    }
  | { ok: false; error: string };

export async function previewDeckImport(formData: FormData): Promise<DeckPreviewResult> {
  await requireUser();
  const text = ((formData.get("text") as string | null) ?? "").trim();

  if (!text) return { ok: false, error: "Paste a deck list first" };

  const { rows, errors, detectedCommanderName } = parseDeckImport(text);
  if (rows.length === 0) {
    return { ok: false, error: errors[0] ?? "No valid rows found" };
  }

  const idMap = await resolveCardsBySetCollector(rows);
  const resolvedIds = Array.from(new Set(idMap.values()));

  const cards =
    resolvedIds.length > 0
      ? await prisma.card.findMany({
          where: { id: { in: resolvedIds } },
          select: { id: true, name: true, imageSmall: true, latestUsd: true },
        })
      : [];
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const previewRows: DeckPreviewRow[] = rows.map((r) => {
    const key = `${r.setCode}|${r.collectorNumber}`;
    const cardId = idMap.get(key) ?? null;
    const card = cardId ? cardMap.get(cardId) : null;
    return {
      name: r.name,
      setCode: r.setCode,
      collectorNumber: r.collectorNumber,
      quantity: r.quantity,
      isCommander: r.isCommander,
      board: r.board,
      cardId,
      cardName: card?.name ?? null,
      imageSmall: card?.imageSmall ?? null,
      latestUsd: card?.latestUsd?.toString() ?? null,
      matched: cardId != null,
    };
  });

  return {
    ok: true,
    rows: previewRows,
    parseErrors: errors,
    detectedCommanderName,
    counts: {
      total: previewRows.length,
      found: previewRows.filter((r) => r.matched).length,
      notFound: previewRows.filter((r) => !r.matched).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Create deck from import
// ---------------------------------------------------------------------------

const createSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  format: z.string().max(60).trim().default(""),
  commanderCardId: z.string().nullable().optional(),
  rows: z.array(
    z.object({
      cardId: z.string().min(1),
      quantity: z.number().int().min(1).max(99),
      isCommander: z.boolean(),
      board: z.enum(["MAIN", "SIDE"]).default("MAIN"),
    }),
  ),
});

export type CreateDeckResult =
  | { ok: true; deckId: string }
  | { ok: false; error: string };

export async function createDeckFromImport(payload: string): Promise<CreateDeckResult> {
  const user = await requireUser();

  let parsed;
  try {
    parsed = createSchema.parse(JSON.parse(payload));
  } catch {
    return { ok: false, error: "Invalid payload" };
  }

  if (parsed.rows.length === 0) {
    return { ok: false, error: "No cards to import" };
  }

  // Verify all cardIds exist
  const ids = Array.from(new Set(parsed.rows.map((r) => r.cardId)));
  const existing = await prisma.card.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const knownIds = new Set(existing.map((c) => c.id));
  const valid = parsed.rows.filter((r) => knownIds.has(r.cardId));

  if (valid.length === 0) {
    return { ok: false, error: "None of the cards were found in the catalog" };
  }

  const deck = await prisma.$transaction(async (tx) => {
    const d = await tx.deck.create({
      data: {
        userId: user.id,
        name: parsed.name,
        format: parsed.format,
        coverCardId: parsed.commanderCardId ?? null,
      },
    });

    await tx.deckCard.createMany({
      data: valid.map((r) => ({
        deckId: d.id,
        cardId: r.cardId,
        quantity: r.quantity,
        board: r.board,
        isCommander: r.isCommander,
      })),
      skipDuplicates: true,
    });

    return d;
  });

  revalidatePath("/decks");
  redirect(`/decks/${deck.id}`);
}
