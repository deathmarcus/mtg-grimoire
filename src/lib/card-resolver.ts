// Shared card resolution helpers for the CSV/deck-list importers
// (collection import, deck import, wishlist import). Consolidates the
// Scryfall-fetch-then-upsert dance and the set+collector matching fallbacks
// that used to be duplicated across each import action.

import { prisma } from "@/lib/prisma";
import { isScryfallId } from "@/lib/scryfall-id";
import { fetchJson, toCardRow, type ScryfallCard, SCRYFALL_API } from "@/lib/scryfall";

/** Max live Scryfall fetches performed per import (fallback for unknown cards). */
export const MAX_LIVE_FETCHES = 50;

/** Normalizes a (setCode, collectorNumber) pair into a lookup key. Always
 * lowercases setCode so writers and readers never disagree on casing. */
export function setCollectorKey(setCode: string, collectorNumber: string): string {
  return `${setCode.toLowerCase()}|${collectorNumber}`;
}

/**
 * Fetches a single card from a Scryfall API URL and upserts it into the
 * local catalog. Returns the card id, or null if the fetch/upsert failed.
 * Callers should space out repeated calls to respect Scryfall's ~10 req/s.
 */
export async function upsertCardFromScryfall(url: string): Promise<string | null> {
  try {
    const card = await fetchJson<ScryfallCard>(url);
    const { legalities, ...rest } = toCardRow(card);
    const data = legalities == null ? rest : { ...rest, legalities };
    await prisma.card.upsert({
      where: { id: rest.id },
      create: data,
      update: data,
    });
    return rest.id;
  } catch {
    return null;
  }
}

/**
 * Ensures every Scryfall id in `rawIds` exists in the local Card catalog,
 * live-fetching unknown-but-valid ids from Scryfall (capped at
 * MAX_LIVE_FETCHES per call). Returns the set of ids now known locally.
 */
export async function ensureCardsExist(rawIds: string[]): Promise<Set<string>> {
  // Normalize casing so uppercase variants of a known id never trigger
  // redundant live fetches (Scryfall ids are lowercase in the catalog).
  const ids = Array.from(new Set(rawIds.map((id) => id.toLowerCase())));
  if (ids.length === 0) return new Set();
  const existing = await prisma.card.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const have = new Set(existing.map((c) => c.id));
  const missing = ids.filter((id) => !have.has(id) && isScryfallId(id));
  if (missing.length === 0) return have;

  // Live Scryfall fallback (respect ~10 req/s with 120ms gap), capped per import.
  for (const id of missing.slice(0, MAX_LIVE_FETCHES)) {
    const resolvedId = await upsertCardFromScryfall(`${SCRYFALL_API}/cards/${id}`);
    if (resolvedId) have.add(id);
    await new Promise((r) => setTimeout(r, 120));
  }
  return have;
}

/**
 * For Moxfield/Arena/wishlist rows: look up Card by (setCode, collectorNumber).
 * Falls back to (name, setCode) case-insensitive. If still missing, attempts
 * a live Scryfall fetch by name+set and upserts the result.
 *
 * Returns a map keyed by `setCollectorKey(setCode, collectorNumber)` → Card id.
 */
export async function resolveCardsBySetCollector(
  rows: { name: string; setCode: string; collectorNumber: string }[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // 1. Bulk lookup by (setCode, collectorNumber) using the @@index
  const unique = Array.from(
    new Map(rows.map((r) => [setCollectorKey(r.setCode, r.collectorNumber), r])).values(),
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
    result.set(setCollectorKey(card.setCode, card.collectorNumber), card.id);
  }

  // 2. For still-missing rows, try name+setCode fallback in DB
  const stillMissing = unique.filter(
    (r) => !result.has(setCollectorKey(r.setCode, r.collectorNumber)),
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
          !result.has(setCollectorKey(r.setCode, r.collectorNumber)),
      );
      if (nameMatch) {
        result.set(setCollectorKey(nameMatch.setCode, nameMatch.collectorNumber), card.id);
      }
    }
  }

  // 3. Live Scryfall fallback for still-missing rows
  const afterNameFallback = unique.filter(
    (r) => !result.has(setCollectorKey(r.setCode, r.collectorNumber)),
  );

  for (const row of afterNameFallback.slice(0, MAX_LIVE_FETCHES)) {
    const searchUrl = `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(row.name)}&set=${encodeURIComponent(row.setCode)}`;
    const resolvedId = await upsertCardFromScryfall(searchUrl);
    if (resolvedId) {
      result.set(setCollectorKey(row.setCode, row.collectorNumber), resolvedId);
    }
    await new Promise((r) => setTimeout(r, 120));
  }

  return result;
}
