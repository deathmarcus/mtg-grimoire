import type { FoilKind } from "@prisma/client";
import { toNumber } from "./money-format";
import { pickPriceForFinish } from "./pricing";

export type TopMoverItem = {
  cardId: string;
  foil: FoilKind;
  card: { name: string; setCode: string; imageNormal: string | null };
};

/**
 * Compute top movers: per owned printing, compare the latest two price
 * snapshots (for the item's finish) and rank by absolute % change.
 */
export function computeTopMovers(
  items: TopMoverItem[],
  snapshots: SnapshotRow[],
): TopMoverInput[] {
  if (items.length === 0 || snapshots.length === 0) return [];

  // Group snapshots by cardId, sorted ascending by date (input order preserved).
  const byCard = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const list = byCard.get(s.cardId) ?? [];
    list.push(s);
    byCard.set(s.cardId, list);
  }

  // De-dupe by cardId — top movers is per printing, not per item row.
  const seen = new Set<string>();
  const inputs: TopMoverInput[] = [];
  for (const it of items) {
    if (seen.has(it.cardId)) continue;
    seen.add(it.cardId);
    const list = byCard.get(it.cardId);
    if (!list || list.length < 2) continue;
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    const latestUsd = pickPriceForFinish(
      { latestUsd: last.priceUsd, latestUsdFoil: last.priceUsdFoil, latestUsdEtched: last.priceUsdEtched },
      it.foil,
    );
    const previousUsd = pickPriceForFinish(
      { latestUsd: prev.priceUsd, latestUsdFoil: prev.priceUsdFoil, latestUsdEtched: prev.priceUsdEtched },
      it.foil,
    );
    const changePct = computePriceChangePct(latestUsd, previousUsd);
    if (latestUsd == null) continue;
    inputs.push({
      cardId: it.cardId,
      name: it.card.name,
      setCode: it.card.setCode,
      imageNormal: it.card.imageNormal,
      latestUsd,
      changePct,
    });
  }
  return pickTopMovers(inputs, 5);
}

export function computePriceChangePct(
  latest: number | null,
  previous: number | null,
): number | null {
  if (latest == null || previous == null) return null;
  if (previous === 0) return null;
  return ((latest - previous) / previous) * 100;
}

export type TopMoverInput = {
  cardId: string;
  name: string;
  setCode: string;
  imageNormal: string | null;
  latestUsd: number | null;
  changePct: number | null;
};

export function pickTopMovers(
  items: TopMoverInput[],
  limit: number,
): TopMoverInput[] {
  return items
    .filter((it) => it.changePct != null)
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    .slice(0, limit);
}

export type SnapshotRow = {
  cardId: string;
  snapshotDate: Date;
  priceUsd: unknown;
  priceUsdFoil: unknown;
  priceUsdEtched: unknown;
};

export type ValuedItem = {
  cardId: string;
  quantity: number;
  foil: FoilKind;
  excluded: boolean;
};

export type ValueHistoryPoint = { date: string; value: number };

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function aggregateValueByDate(
  items: ValuedItem[],
  snapshots: SnapshotRow[],
): ValueHistoryPoint[] {
  if (snapshots.length === 0) return [];
  const activeItems = items.filter((it) => !it.excluded);
  if (activeItems.length === 0) return [];

  // Group snapshots by cardId for fast lookup; key by date string.
  const byDateAndCard = new Map<string, Map<string, SnapshotRow>>();
  for (const s of snapshots) {
    const dateKey = isoDay(s.snapshotDate);
    let cardMap = byDateAndCard.get(dateKey);
    if (!cardMap) {
      cardMap = new Map();
      byDateAndCard.set(dateKey, cardMap);
    }
    cardMap.set(s.cardId, s);
  }

  const result: ValueHistoryPoint[] = [];
  for (const [date, cardMap] of byDateAndCard.entries()) {
    let total = 0;
    for (const it of activeItems) {
      const snap = cardMap.get(it.cardId);
      if (!snap) continue;
      const price = pickPriceForFinish(
        {
          latestUsd: snap.priceUsd,
          latestUsdFoil: snap.priceUsdFoil,
          latestUsdEtched: snap.priceUsdEtched,
        },
        it.foil,
      );
      if (price != null) total += price * it.quantity;
    }
    result.push({ date, value: total });
  }
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export type Range = "1m" | "3m" | "6m" | "1y" | "all";

const RANGE_DAYS: Record<Range, number | null> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  all: null,
};

export function filterValueHistoryByRange(
  history: ValueHistoryPoint[],
  range: Range,
  now: Date = new Date(),
): ValueHistoryPoint[] {
  const days = RANGE_DAYS[range];
  if (days == null) return history;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const cutoffIso = isoDay(cutoff);
  return history.filter((p) => p.date >= cutoffIso);
}

// Re-export toNumber so callers can normalize Decimal-like values from Prisma
export { toNumber };
