// src/lib/deck-ownership.ts
/**
 * Señal "owned" para decks (F11 #24): cruza las cantidades del deck contra
 * la colección del usuario agregada por nombre. Matching por nombre lowercase
 * (cualquier printing cubre), cantidad-aware con clamp, mainboard + comandante.
 * Spec: docs/superpowers/specs/2026-07-11-stock-aware-deck-building-design.md
 */

export type OwnershipCard = {
  name: string;
  quantity: number;
  board: "MAIN" | "SIDE";
  isCommander: boolean;
  priceUsd: number | null;
};

export type MissingCard = {
  name: string;
  missingQty: number;
  deckPrintingCost: number | null;
  cheapestCost: number | null;
};

export type DeckOwnership = {
  /** key: nombre lowercase */
  perCard: Record<string, { ownedQty: number; neededQty: number }>;
  totalNeeded: number;
  totalOwned: number;
  /** entero 0..100, Math.round */
  pct: number;
  missing: MissingCard[];
  /** suma con el precio del printing que lista el deck (faltantes con precio) */
  costToComplete: number;
  /** suma con el printing más barato del catálogo; cae al del deck si falta */
  costToCompleteCheapest: number;
  /** true si algún faltante quedó fuera de las sumas por no tener precio */
  costIsApprox: boolean;
};

export function computeDeckOwnership(
  cards: OwnershipCard[],
  ownedByName: Record<string, number>,
  cheapestByName?: Record<string, number | null>,
): DeckOwnership {
  // Agrega cantidades del deck por nombre (mainboard + comandante)
  const needed = new Map<
    string,
    { neededQty: number; priceUsd: number | null; displayName: string }
  >();
  for (const c of cards) {
    if (c.board !== "MAIN" && !c.isCommander) continue;
    const key = c.name.toLowerCase();
    const cur = needed.get(key);
    if (cur) {
      cur.neededQty += c.quantity;
      if (cur.priceUsd === null) cur.priceUsd = c.priceUsd;
    } else {
      needed.set(key, { neededQty: c.quantity, priceUsd: c.priceUsd, displayName: c.name });
    }
  }

  const perCard: DeckOwnership["perCard"] = {};
  const missing: MissingCard[] = [];
  let totalNeeded = 0;
  let totalOwned = 0;
  let costToComplete = 0;
  let costToCompleteCheapest = 0;
  let costIsApprox = false;

  for (const [key, info] of needed) {
    const ownedQty = Math.min(ownedByName[key] ?? 0, info.neededQty);
    perCard[key] = { ownedQty, neededQty: info.neededQty };
    totalNeeded += info.neededQty;
    totalOwned += ownedQty;

    const missingQty = info.neededQty - ownedQty;
    if (missingQty === 0) continue;

    const cheapestCost = cheapestByName?.[key] ?? null;
    missing.push({
      name: info.displayName,
      missingQty,
      deckPrintingCost: info.priceUsd,
      cheapestCost,
    });

    if (info.priceUsd === null) costIsApprox = true;
    else costToComplete += info.priceUsd * missingQty;

    const cheapEffective = cheapestCost ?? info.priceUsd;
    if (cheapEffective !== null) costToCompleteCheapest += cheapEffective * missingQty;
  }

  const pct = totalNeeded === 0 ? 0 : Math.round((totalOwned / totalNeeded) * 100);

  return {
    perCard,
    totalNeeded,
    totalOwned,
    pct,
    missing,
    costToComplete,
    costToCompleteCheapest,
    costIsApprox,
  };
}
