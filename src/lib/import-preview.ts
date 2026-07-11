// Shared helpers for building CSV/deck-list import preview rows. Consolidates
// the card-map/existing-item-map lookup logic that used to be duplicated
// between the Manabox CSV branch and the Moxfield/Arena deck-row branch of
// `previewImport`.

import { prisma } from "@/lib/prisma";

export type CardLookup = {
  id: string;
  name: string;
  imageSmall: string | null;
  imageNormal: string | null;
  latestUsd: unknown;
};

export type ExistingItem = {
  cardId: string;
  foil: string;
  language: string;
  condition: string;
  quantity: number;
};

export type EnrichKey = {
  cardId: string | null;
  foil: string;
  language: string;
  condition: string;
};

export type EnrichedFields = {
  matched: boolean;
  existingQuantity: number;
  cardName: string | null;
  imageSmall: string | null;
  imageNormal: string | null;
  latestUsd: string | null;
};

export function itemKey(cardId: string, foil: string, language: string, condition: string): string {
  return `${cardId}|${foil}|${language}|${condition}`;
}

/** Pure: enriches a list of resolved (cardId, foil, language, condition) keys
 * with match state, card display info, and existing-collection quantity. */
export function enrichRows(
  keys: EnrichKey[],
  cards: CardLookup[],
  existingItems: ExistingItem[],
): EnrichedFields[] {
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const existingMap = new Map(
    existingItems.map((i) => [itemKey(i.cardId, i.foil, i.language, i.condition), i.quantity]),
  );

  return keys.map((k) => {
    const matched = k.cardId != null;
    const card = matched && k.cardId ? cardMap.get(k.cardId) : null;
    const existingQuantity =
      matched && k.cardId
        ? existingMap.get(itemKey(k.cardId, k.foil, k.language, k.condition)) ?? 0
        : 0;
    return {
      matched,
      existingQuantity,
      cardName: card?.name ?? null,
      imageSmall: card?.imageSmall ?? null,
      imageNormal: card?.imageNormal ?? null,
      latestUsd: card?.latestUsd != null ? String(card.latestUsd) : null,
    };
  });
}

/** Wrapper: fetches the cards and the user's existing collection items for a
 * set of card ids, ready to feed into `enrichRows`. */
export async function loadCardsAndExistingItems(
  userId: string,
  cardIds: string[],
): Promise<{ cards: CardLookup[]; existingItems: ExistingItem[] }> {
  const ids = Array.from(new Set(cardIds));
  if (ids.length === 0) return { cards: [], existingItems: [] };

  const [cards, existingItems] = await Promise.all([
    prisma.card.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, imageSmall: true, imageNormal: true, latestUsd: true },
    }),
    prisma.collectionItem.findMany({
      where: { userId, cardId: { in: ids } },
      select: { cardId: true, foil: true, language: true, condition: true, quantity: true },
    }),
  ]);

  return { cards, existingItems };
}
