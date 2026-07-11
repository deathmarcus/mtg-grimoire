"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireOwnedCollectionId } from "@/lib/collections";
import { logActivity } from "@/lib/activity";
import { parseManaboxCsv, type ManaboxRow } from "@/lib/manabox";
import { parseMoxfieldTxt } from "@/lib/deck-parser";
import { parseArenaTxt } from "@/lib/arena-parser";
import {
  ensureCardsExist,
  resolveCardsBySetCollector,
  setCollectorKey,
} from "@/lib/card-resolver";
import { enrichRows, itemKey, loadCardsAndExistingItems } from "@/lib/import-preview";
import { planImport } from "@/lib/import-apply";

export type ImportFormat = "manabox" | "moxfield" | "arena";

/** Max rows accepted in a single import payload. */
const MAX_IMPORT_ROWS = 5000;

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

  const keys = rawRows.map((r) => ({
    cardId: idMap.get(setCollectorKey(r.setCode, r.collectorNumber)) ?? null,
    foil: "NORMAL",
    language: "en",
    condition: "NM",
  }));

  const resolvedIds = Array.from(new Set(idMap.values()));
  const { cards, existingItems } = await loadCardsAndExistingItems(userId, resolvedIds);
  const enriched = enrichRows(keys, cards, existingItems);

  const rows: PreviewRow[] = rawRows.map((r, idx) => {
    const cardId = keys[idx].cardId;
    if (cardId == null) {
      errors.push(`Row ${idx + 1}: could not match "${r.name}" (${r.setCode} #${r.collectorNumber})`);
    }

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
      ...enriched[idx],
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
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      return { ok: false, error: `Too many rows (max ${MAX_IMPORT_ROWS})` };
    }
    const ids = Array.from(new Set(parsed.rows.map((r) => r.scryfallId)));
    const known = await ensureCardsExist(ids);

    const { cards, existingItems } = await loadCardsAndExistingItems(user.id, Array.from(known));
    const keys = parsed.rows.map((r) => ({
      cardId: known.has(r.scryfallId) ? r.scryfallId : null,
      foil: r.foil,
      language: r.language,
      condition: r.condition,
    }));
    const enriched = enrichRows(keys, cards, existingItems);

    rows = parsed.rows.map((r, idx) => ({ ...r, ...enriched[idx] }));
    errors = parsed.errors;
  } else if (format === "moxfield") {
    const parsed = parseMoxfieldTxt(text);
    if (parsed.rows.length === 0) {
      return { ok: false, error: "No valid rows found in TXT file" };
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      return { ok: false, error: `Too many rows (max ${MAX_IMPORT_ROWS})` };
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
    if (parsed.length > MAX_IMPORT_ROWS) {
      return { ok: false, error: `Too many rows (max ${MAX_IMPORT_ROWS})` };
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
  rows: z
    .array(
      z.object({
        scryfallId: z.string().min(1),
        quantity: z.number().int().min(1),
        foil: z.enum(["NORMAL", "FOIL", "ETCHED"]),
        condition: z.enum(["NM", "LP", "MP", "HP", "DMG"]),
        language: z.string().min(1).max(8),
        acquiredPrice: z.number().nullable(),
        acquiredCurrency: z.string().nullable(),
      }),
    )
    .max(MAX_IMPORT_ROWS),
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

  const collectionId = await requireOwnedCollectionId(user.id, parsed.collectionId);
  if (!collectionId) return { ok: false, error: "Invalid collection" };

  // TODO(concurrency): existing keys are read outside the tx; concurrent applies can make skipDuplicates drop rows silently — mitigated by the UI double-submit guard; full fix is serializable isolation.
  let existingKeys = new Set<string>();
  if (parsed.mode === "add") {
    const existingItems = await prisma.collectionItem.findMany({
      where: { userId: user.id, collectionId, cardId: { in: ids } },
      select: { cardId: true, foil: true, language: true, condition: true },
    });
    existingKeys = new Set(
      existingItems.map((i) => itemKey(i.cardId, i.foil, i.language, i.condition)),
    );
  }

  const plan = planImport(valid, existingKeys, parsed.mode);
  const inserted = plan.inserted;
  const merged = plan.merged;

  await prisma.$transaction(
    async (tx) => {
      if (parsed.mode === "replace") {
        await tx.collectionItem.deleteMany({
          where: { userId: user.id, collectionId },
        });
      }

      if (plan.toCreate.length > 0) {
        await tx.collectionItem.createMany({
          data: plan.toCreate.map((r) => ({
            userId: user.id,
            collectionId,
            cardId: r.scryfallId,
            quantity: r.quantity,
            foil: r.foil,
            language: r.language,
            condition: r.condition,
            acquiredPrice: r.acquiredPrice ?? undefined,
          })),
          skipDuplicates: true,
        });
      }

      for (const r of plan.toUpdate) {
        await tx.collectionItem.update({
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
          data: {
            quantity: { increment: r.quantity },
          },
        });
      }
    },
    { timeout: 30000 },
  );

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

export async function getRecentImports(limit = 5): Promise<RecentImport[]> {
  const user = await requireUser();
  const logs = await prisma.importLog.findMany({
    where: { userId: user.id },
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
