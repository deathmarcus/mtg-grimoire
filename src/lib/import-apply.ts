// Pure planning logic for applying an import payload to a collection.
// Kept side-effect free and DB-agnostic so it can be unit tested without
// mocking Prisma; `applyImport` in the import action feeds it real data and
// executes the resulting plan inside a single batched transaction.

import type { FoilKind, Condition } from "@prisma/client";
import { itemKey } from "@/lib/import-preview";

export type ApplyRow = {
  scryfallId: string;
  quantity: number;
  foil: FoilKind;
  language: string;
  condition: Condition;
  acquiredPrice: number | null;
  acquiredCurrency: string | null;
};

/** Sums quantities for rows that share the same cardId+foil+language+condition
 * within a single payload, so a `createMany({ skipDuplicates: true })` never
 * silently drops quantity from a duplicate row. */
export function aggregateRows(rows: ApplyRow[]): ApplyRow[] {
  const map = new Map<string, ApplyRow>();
  for (const r of rows) {
    const key = itemKey(r.scryfallId, r.foil, r.language, r.condition);
    const existing = map.get(key);
    if (existing) {
      existing.quantity += r.quantity;
    } else {
      map.set(key, { ...r });
    }
  }
  return Array.from(map.values());
}

export type ImportPlan = {
  toCreate: ApplyRow[];
  toUpdate: ApplyRow[];
  inserted: number;
  merged: number;
};

/** Splits (already-aggregated-if-needed) rows into new inserts vs quantity
 * merges, given the set of existing item keys for this user+collection.
 * In "replace" mode nothing is considered existing — the collection is
 * wiped first, so every row is a fresh insert. */
export function planImport(
  rows: ApplyRow[],
  existingKeys: Set<string>,
  mode: "add" | "replace",
): ImportPlan {
  const aggregated = aggregateRows(rows);
  const toCreate: ApplyRow[] = [];
  const toUpdate: ApplyRow[] = [];

  for (const r of aggregated) {
    const key = itemKey(r.scryfallId, r.foil, r.language, r.condition);
    if (mode === "add" && existingKeys.has(key)) {
      toUpdate.push(r);
    } else {
      toCreate.push(r);
    }
  }

  return { toCreate, toUpdate, inserted: toCreate.length, merged: toUpdate.length };
}
