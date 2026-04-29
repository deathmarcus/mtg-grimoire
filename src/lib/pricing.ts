import type { FoilKind } from "@prisma/client";
import { toNumber } from "./money-format";

export type PriceCard = {
  latestUsd?: unknown;
  latestUsdFoil?: unknown;
  latestUsdEtched?: unknown;
};

export function pickPriceForFinish(
  card: PriceCard,
  finish: FoilKind,
): number | null {
  const primary =
    finish === "FOIL"
      ? card.latestUsdFoil
      : finish === "ETCHED"
        ? card.latestUsdEtched
        : card.latestUsd;
  const main = toNumber(primary);
  if (main != null) return main;
  // Fallback to normal USD when finish-specific price is missing.
  if (finish !== "NORMAL") return toNumber(card.latestUsd);
  return null;
}

export type AggregateItem = {
  cardId: string;
  quantity: number;
  foil: FoilKind;
  excluded: boolean;
  card: PriceCard;
};

export type AggregateBucket = {
  totalUsd: number;
  totalCards: number;
  uniquePrintings: number;
};

export type AggregateResult = {
  included: AggregateBucket;
  excluded: AggregateBucket;
  totalCards: number;
  uniquePrintings: number;
};

export function aggregateCollectionValue(items: AggregateItem[]): AggregateResult {
  const included: AggregateBucket = { totalUsd: 0, totalCards: 0, uniquePrintings: 0 };
  const excluded: AggregateBucket = { totalUsd: 0, totalCards: 0, uniquePrintings: 0 };
  const includedCards = new Set<string>();
  const excludedCards = new Set<string>();
  const allCards = new Set<string>();

  for (const it of items) {
    const bucket = it.excluded ? excluded : included;
    const cardSet = it.excluded ? excludedCards : includedCards;
    bucket.totalCards += it.quantity;
    cardSet.add(it.cardId);
    allCards.add(it.cardId);
    const price = pickPriceForFinish(it.card, it.foil);
    if (price != null) bucket.totalUsd += price * it.quantity;
  }

  included.uniquePrintings = includedCards.size;
  excluded.uniquePrintings = excludedCards.size;

  return {
    included,
    excluded,
    totalCards: included.totalCards + excluded.totalCards,
    uniquePrintings: allCards.size,
  };
}

export type Point = { x: number; y: number };

/**
 * Map a numeric series onto an (0..width) x (0..height) box.
 * Highest value = y:0 (top), lowest = y:height.
 * Flat series centers vertically. Single point sits at (0, height/2).
 */
export function sparklineScale(
  values: number[],
  width: number,
  height: number,
): Point[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [{ x: 0, y: height / 2 }];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const stepX = width / (values.length - 1);

  return values.map((v, i) => {
    const x = stepX * i;
    const y = range === 0 ? height / 2 : height - ((v - min) / range) * height;
    return { x, y };
  });
}
