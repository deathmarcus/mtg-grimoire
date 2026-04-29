/**
 * Pure helper functions for the Stats page.
 * All functions are side-effect-free and tested in stats.test.ts.
 */

// ---------------------------------------------------------------------------
// Color distribution
// ---------------------------------------------------------------------------

export type ColorDistributionInput = {
  colorIdentity: string[];
  latestUsd: number | null;
  quantity: number;
};

export type ColorDistributionRow = {
  color: string; // W | U | B | R | G | C | M
  totalValue: number;
  count: number;
};

/**
 * Aggregate items by color identity.
 * - single-color card: color = the single letter (W/U/B/R/G)
 * - multi-color (>1):  color = 'M'
 * - colorless (empty): color = 'C'
 * Returns rows sorted by totalValue descending.
 */
export function getColorDistribution(
  items: ColorDistributionInput[],
): ColorDistributionRow[] {
  const map = new Map<string, ColorDistributionRow>();

  for (const item of items) {
    let color: string;
    if (item.colorIdentity.length === 0) {
      color = "C";
    } else if (item.colorIdentity.length === 1) {
      color = item.colorIdentity[0];
    } else {
      color = "M";
    }

    const existing = map.get(color);
    const value = (item.latestUsd ?? 0) * item.quantity;
    if (existing) {
      existing.totalValue += value;
      existing.count += 1;
    } else {
      map.set(color, { color, totalValue: value, count: 1 });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
}

// ---------------------------------------------------------------------------
// Rarity distribution
// ---------------------------------------------------------------------------

export type RarityDistributionInput = {
  rarity: string;
};

export type RarityDistributionRow = {
  rarity: string;
  count: number;
  pct: number;
};

const RARITY_ORDER = ["mythic", "rare", "uncommon", "common"];

/**
 * Count items by rarity and compute percentage of total.
 * Order: mythic > rare > uncommon > common, then any unknowns alphabetically.
 */
export function getRarityDistribution(
  items: RarityDistributionInput[],
): RarityDistributionRow[] {
  if (items.length === 0) return [];

  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.rarity, (counts.get(item.rarity) ?? 0) + 1);
  }

  const total = items.length;
  const rows: RarityDistributionRow[] = [];

  // Emit in canonical order first
  for (const rarity of RARITY_ORDER) {
    const count = counts.get(rarity);
    if (count !== undefined) {
      rows.push({ rarity, count, pct: (count / total) * 100 });
      counts.delete(rarity);
    }
  }

  // Any remaining rarities (unknown values) alphabetically
  for (const [rarity, count] of [...counts.entries()].sort()) {
    rows.push({ rarity, count, pct: (count / total) * 100 });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Most valuable items
// ---------------------------------------------------------------------------

export type ValuableItem = {
  id: string;
  cardId: string;
  latestUsd: number | null;
  quantity: number;
};

/**
 * Return top N items by (latestUsd ?? 0) * quantity, descending.
 */
export function getMostValuableItems<T extends ValuableItem>(
  items: T[],
  limit: number,
): T[] {
  return [...items]
    .sort(
      (a, b) =>
        (b.latestUsd ?? 0) * b.quantity - (a.latestUsd ?? 0) * a.quantity,
    )
    .slice(0, limit);
}
