"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getDefaultCollectionId } from "@/lib/collections";
import { logActivity } from "@/lib/activity";
import { parseManaboxCsv, type ManaboxRow } from "@/lib/manabox";
import { parseMoxfieldTxt } from "@/lib/deck-parser";
import { parseArenaTxt } from "@/lib/arena-parser";
import {
  fetchJson,
  toCardRow,
  type ScryfallCard,
  SCRYFALL_API,
} from "../../../../scripts/lib/scryfall";

export type ImportFormat = "manabox" | "moxfield" | "arena";

export type PreviewRow = ManaboxRow & {
  matched: boolean;
  existingQuantity: number;
  cardName: string | null;
  imageSmall: string | null;
  latestUsd: string | null;
};

export type PreviewResult =
  | {
      ok: true;
      rows: PreviewRow[];
      parseErrors: string[];
      counts: {
        total: number;
        totalQuantity: number;
        matched: number;
        merged: number;
        newItems: number;
        missing: number;
      };
    }
  | { ok: false; error: string };

export type RecentImport = {
  id: string;
  filename: string;
  format: string;
  cardCount: number;
  newCount: number;
  mergedCount: number;
  createdAt: Date;
};

async function ensureCardsExist(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const existing = await prisma.card.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const have = new Set(existing.map((c) => c.id));
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length === 0) return have;

  // Live Scryfall fallback (respect ~10 req/s with 120ms gap).
  for (const id of missing) {
    try {
      const card = await fetchJson<ScryfallCard>(`${SCRYFALL_API}/cards/${id}`);
      const { legalities, ...rest } = toCardRow(card);
      const data = legalities == null ? rest : { ...rest, legalities };
      await prisma.card.upsert({
        where: { id: rest.id },
        create: data,
        update: data,
      });
      have.add(id);
    } catch {
      // leave as missing
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return have;
}

/**
 * For Moxfield/Arena rows: look up Card by (setCode, collectorNumber).
 * Falls back to (name, setCode). If still missing, attempts a live Scryfall
 * fetch by name+set and upserts the result.
 *
 * Returns a map from `${setCode}|${collectorNumber}` → Card id.
 */
async function resolveCardsBySetCollector(
  rows: { name: string; setCode: string; collectorNumber: string }[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // 1. Bulk lookup by (setCode, collectorNumber) using the @@index
  const unique = Array.from(
    new Map(rows.map((r) => [`${r.setCode}|${r.collectorNumber}`, r])).values(),
  );

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

  // 2. For still-missing rows, try name+setCode fallback in DB
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
      // Only fill in entries that are still missing
      const nameMatch = stillMissing.find(
        (r) =>
          r.name.toLowerCase() === card.name.toLowerCase() &&
          r.setCode.toLowerCase() === card.setCode.toLowerCase() &&
          !result.has(`${r.setCode}|${r.collectorNumber}`),
      );
      if (nameMatch) {
        result.set(
          `${nameMatch.setCode}|${nameMatch.collectorNumber}`,
          card.id,
        );
      }
    }
  }

  // 3. Live Scryfall fallback for still-missing rows
  const afterNameFallback = unique.filter(
    (r) => !result.has(`${r.setCode}|${r.collectorNumber}`),
  );

  for (const row of afterNameFallback) {
    try {
      // Search Scryfall by name + set
      const searchUrl = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(row.name)}&set=${encodeURIComponent(row.setCode)}`;
      const card = await fetchJson<ScryfallCard>(searchUrl);
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

/**
 * Convert Moxfield/Arena rows into ManaboxRow-compatible PreviewRows.
 * Uses setCode+collectorNumber lookup with name+set fallback and live Scryfall.
 */
async function previewDeckRows(
  rawRows: { name: string; setCode: string; collectorNumber: string; quantity: number }[],
  userId: string,
): Promise<{ rows: PreviewRow[]; errors: string[] }> {
  const errors: string[] = [];

  const idMap = await resolveCardsBySetCollector(rawRows);

  // Collect all resolved card IDs for a single DB query
  const resolvedIds = Array.from(new Set(idMap.values()));
  const cards = await prisma.card.findMany({
    where: { id: { in: resolvedIds } },
    select: { id: true, name: true, imageSmall: true, latestUsd: true },
  });
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const existingItems =
    resolvedIds.length > 0
      ? await prisma.collectionItem.findMany({
          where: { userId, cardId: { in: resolvedIds } },
          select: {
            cardId: true,
            foil: true,
            language: true,
            condition: true,
            quantity: true,
          },
        })
      : [];

  const itemKey = (cardId: string, foil: string, language: string, condition: string) =>
    `${cardId}|${foil}|${language}|${condition}`;
  const existingMap = new Map(
    existingItems.map((i) => [
      itemKey(i.cardId, i.foil, i.language, i.condition),
      i.quantity,
    ]),
  );

  const rows: PreviewRow[] = rawRows.map((r, idx) => {
    const key = `${r.setCode}|${r.collectorNumber}`;
    const cardId = idMap.get(key) ?? null;
    const card = cardId ? cardMap.get(cardId) : null;
    const matched = cardId != null;

    if (!matched) {
      errors.push(`Row ${idx + 1}: could not match "${r.name}" (${r.setCode} #${r.collectorNumber})`);
    }

    const existingQty = matched && cardId
      ? existingMap.get(itemKey(cardId, "NORMAL", "en", "NM")) ?? 0
      : 0;

    return {
      // ManaboxRow fields with defaults for non-Manabox imports
      scryfallId: cardId ?? "",
      name: r.name,
      setCode: r.setCode,
      setName: r.setCode,
      collectorNumber: r.collectorNumber,
      foil: "NORMAL" as const,
      rarity: "",
      quantity: r.quantity,
      manaboxId: "",
      condition: "NM" as const,
      language: "en",
      acquiredPrice: null,
      acquiredCurrency: null,
      // PreviewRow fields
      matched,
      existingQuantity: existingQty,
      cardName: card?.name ?? null,
      imageSmall: card?.imageSmall ?? null,
      latestUsd: card?.latestUsd?.toString() ?? null,
    };
  });

  return { rows, errors };
}

export async function previewImport(formData: FormData): Promise<PreviewResult> {
  const user = await requireUser();
  const file = formData.get("file");
  const format = (formData.get("format") as ImportFormat | null) ?? "manabox";

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Upload a file" };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "File too large (max 5 MB)" };
  }
  const text = await file.text();

  let rows: PreviewRow[];
  let errors: string[];

  if (format === "manabox") {
    const parsed = parseManaboxCsv(text);
    if (parsed.rows.length === 0) {
      return { ok: false, error: "No valid rows found in CSV" };
    }
    const ids = Array.from(new Set(parsed.rows.map((r) => r.scryfallId)));
    const known = await ensureCardsExist(ids);

    const cards = await prisma.card.findMany({
      where: { id: { in: Array.from(known) } },
      select: { id: true, name: true, imageSmall: true, latestUsd: true },
    });
    const cardMap = new Map(cards.map((c) => [c.id, c]));

    const existingItems = await prisma.collectionItem.findMany({
      where: { userId: user.id, cardId: { in: Array.from(known) } },
      select: { cardId: true, foil: true, language: true, condition: true, quantity: true },
    });
    const itemKey = (cardId: string, foil: string, language: string, condition: string) =>
      `${cardId}|${foil}|${language}|${condition}`;
    const existingMap = new Map(
      existingItems.map((i) => [
        itemKey(i.cardId, i.foil, i.language, i.condition),
        i.quantity,
      ]),
    );

    rows = parsed.rows.map((r) => {
      const matched = known.has(r.scryfallId);
      const card = matched ? cardMap.get(r.scryfallId) : null;
      const existingQty = matched
        ? existingMap.get(itemKey(r.scryfallId, r.foil, r.language, r.condition)) ?? 0
        : 0;
      return {
        ...r,
        matched,
        existingQuantity: existingQty,
        cardName: card?.name ?? null,
        imageSmall: card?.imageSmall ?? null,
        latestUsd: card?.latestUsd?.toString() ?? null,
      };
    });
    errors = parsed.errors;
  } else if (format === "moxfield") {
    const parsed = parseMoxfieldTxt(text);
    if (parsed.rows.length === 0) {
      return { ok: false, error: "No valid rows found in TXT file" };
    }
    const preview = await previewDeckRows(parsed.rows, user.id);
    rows = preview.rows;
    errors = [...parsed.errors, ...preview.errors];
  } else {
    // arena
    const parsed = parseArenaTxt(text);
    if (parsed.length === 0) {
      return { ok: false, error: "No valid rows found in Arena export" };
    }
    const preview = await previewDeckRows(parsed, user.id);
    rows = preview.rows;
    errors = preview.errors;
  }

  const counts = {
    total: rows.length,
    totalQuantity: rows.reduce((a, r) => a + r.quantity, 0),
    matched: rows.filter((r) => r.matched).length,
    merged: rows.filter((r) => r.matched && r.existingQuantity > 0).length,
    newItems: rows.filter((r) => r.matched && r.existingQuantity === 0).length,
    missing: rows.filter((r) => !r.matched).length,
  };

  return { ok: true, rows, parseErrors: errors, counts };
}

const applySchema = z.object({
  mode: z.enum(["add", "replace"]),
  collectionId: z.string().min(1).optional(),
  format: z.enum(["manabox", "moxfield", "arena"]).default("manabox"),
  filename: z.string().default("import"),
  rows: z.array(
    z.object({
      scryfallId: z.string().min(1),
      quantity: z.number().int().min(1),
      foil: z.enum(["NORMAL", "FOIL", "ETCHED"]),
      condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]),
      language: z.string().min(1).max(8),
      acquiredPrice: z.number().nullable(),
      acquiredCurrency: z.string().nullable(),
    }),
  ),
});

export type ApplyResult =
  | { ok: true; inserted: number; merged: number; replaced: boolean }
  | { ok: false; error: string };

export async function applyImport(payload: string): Promise<ApplyResult> {
  const user = await requireUser();
  let parsed;
  try {
    parsed = applySchema.parse(JSON.parse(payload));
  } catch {
    return { ok: false, error: "Invalid payload" };
  }

  const ids = Array.from(new Set(parsed.rows.map((r) => r.scryfallId)));
  const existing = await prisma.card.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const knownIds = new Set(existing.map((c) => c.id));
  const valid = parsed.rows.filter((r) => knownIds.has(r.scryfallId));

  const collectionId = parsed.collectionId ?? (await getDefaultCollectionId(user.id));

  let inserted = 0;
  let merged = 0;

  await prisma.$transaction(async (tx) => {
    if (parsed.mode === "replace") {
      await tx.collectionItem.deleteMany({
        where: { userId: user.id, collectionId },
      });
    }
    for (const r of valid) {
      const existingItem =
        parsed.mode === "add"
          ? await tx.collectionItem.findUnique({
              where: {
                userId_collectionId_cardId_foil_language_condition: {
                  userId: user.id,
                  collectionId,
                  cardId: r.scryfallId,
                  foil: r.foil,
                  language: r.language,
                  condition: r.condition,
                },
              },
              select: { id: true },
            })
          : null;
      if (existingItem) merged++;
      else inserted++;
      await tx.collectionItem.upsert({
        where: {
          userId_collectionId_cardId_foil_language_condition: {
            userId: user.id,
            collectionId,
            cardId: r.scryfallId,
            foil: r.foil,
            language: r.language,
            condition: r.condition,
          },
        },
        create: {
          userId: user.id,
          collectionId,
          cardId: r.scryfallId,
          quantity: r.quantity,
          foil: r.foil,
          language: r.language,
          condition: r.condition,
          acquiredPrice: r.acquiredPrice ?? undefined,
        },
        update: {
          quantity: { increment: r.quantity },
        },
      });
    }
  });

  // Write ImportLog
  await prisma.importLog.create({
    data: {
      userId: user.id,
      filename: parsed.filename,
      cardCount: valid.length,
      newCount: inserted,
      mergedCount: merged,
      format: parsed.format,
    },
  });

  const collectionRow = await prisma.collection.findUnique({
    where: { id: collectionId },
    select: { name: true },
  });
  await logActivity(user.id, "import", {
    inserted,
    merged,
    total: valid.length,
    collectionName: collectionRow?.name ?? "Mi colección",
    replaced: parsed.mode === "replace",
  });

  revalidatePath("/collection");
  revalidatePath("/dashboard");
  revalidatePath("/import");

  return {
    ok: true,
    inserted,
    merged,
    replaced: parsed.mode === "replace",
  };
}

export async function getRecentImports(
  userId: string,
  limit = 5,
): Promise<RecentImport[]> {
  const logs = await prisma.importLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      filename: true,
      format: true,
      cardCount: true,
      newCount: true,
      mergedCount: true,
      createdAt: true,
    },
  });
  return logs;
}
