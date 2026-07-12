// src/lib/deck-ownership.test.ts
import { describe, it, expect } from "vitest";
import { computeDeckOwnership, type OwnershipCard } from "./deck-ownership";

const card = (over: Partial<OwnershipCard>): OwnershipCard => ({
  name: "Lightning Bolt",
  quantity: 1,
  board: "MAIN",
  isCommander: false,
  priceUsd: 1,
  ...over,
});

describe("computeDeckOwnership", () => {
  it("deck vacío → 0/0, pct 0, sin faltantes", () => {
    const r = computeDeckOwnership([], {});
    expect(r).toMatchObject({
      totalNeeded: 0, totalOwned: 0, pct: 0,
      missing: [], costToComplete: 0, costToCompleteCheapest: 0, costIsApprox: false,
    });
  });

  it("cuenta parcial cantidad-aware: pide 4, tienes 2 → 2/4 y faltan 2", () => {
    const r = computeDeckOwnership(
      [card({ quantity: 4, priceUsd: 2 })],
      { "lightning bolt": 2 },
    );
    expect(r.perCard["lightning bolt"]).toEqual({ ownedQty: 2, neededQty: 4 });
    expect(r.totalOwned).toBe(2);
    expect(r.totalNeeded).toBe(4);
    expect(r.pct).toBe(50);
    expect(r.missing).toEqual([
      { name: "Lightning Bolt", missingQty: 2, deckPrintingCost: 2, cheapestCost: null },
    ]);
    expect(r.costToComplete).toBe(4); // 2 faltantes × $2
  });

  it("clamp por exceso: tienes 6 cuando pide 4 → 4/4, pct 100", () => {
    const r = computeDeckOwnership([card({ quantity: 4 })], { "lightning bolt": 6 });
    expect(r.perCard["lightning bolt"]).toEqual({ ownedQty: 4, neededQty: 4 });
    expect(r.pct).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it("matching case-insensitive por nombre", () => {
    const r = computeDeckOwnership(
      [card({ name: "LIGHTNING BOLT" })],
      { "lightning bolt": 1 },
    );
    expect(r.pct).toBe(100);
  });

  it("agrega filas del deck con el mismo nombre antes de comparar", () => {
    const r = computeDeckOwnership(
      [card({ quantity: 2 }), card({ quantity: 2 })],
      { "lightning bolt": 3 },
    );
    expect(r.perCard["lightning bolt"]).toEqual({ ownedQty: 3, neededQty: 4 });
  });

  it("excluye board SIDE, incluye comandante", () => {
    const r = computeDeckOwnership(
      [
        card({ name: "Sol Ring", board: "MAIN", quantity: 1 }),
        card({ name: "Atraxa", board: "MAIN", isCommander: true, quantity: 1 }),
        card({ name: "Opt", board: "SIDE", quantity: 3 }),
      ],
      {},
    );
    expect(r.totalNeeded).toBe(2); // Sol Ring + Atraxa; Opt fuera
    expect(r.perCard["opt"]).toBeUndefined();
  });

  it("costo con ambos precios: printing del deck y más barato", () => {
    const r = computeDeckOwnership(
      [card({ name: "Force of Will", quantity: 1, priceUsd: 80 })],
      {},
      { "force of will": 55 },
    );
    expect(r.costToComplete).toBe(80);
    expect(r.costToCompleteCheapest).toBe(55);
    expect(r.missing[0]).toEqual({
      name: "Force of Will", missingQty: 1, deckPrintingCost: 80, cheapestCost: 55,
    });
  });

  it("cheapest cae al precio del deck si no hay dato más barato", () => {
    const r = computeDeckOwnership([card({ quantity: 2, priceUsd: 3 })], {});
    expect(r.costToCompleteCheapest).toBe(6);
  });

  it("faltante sin precio en ningún lado → excluido de sumas y costIsApprox", () => {
    const r = computeDeckOwnership(
      [card({ name: "Oscura", quantity: 2, priceUsd: null }), card({ quantity: 1, priceUsd: 5 })],
      {},
    );
    expect(r.costIsApprox).toBe(true);
    expect(r.costToComplete).toBe(5);
    expect(r.costToCompleteCheapest).toBe(5);
  });

  it("pct redondea al entero más cercano", () => {
    const r = computeDeckOwnership([card({ quantity: 3 })], { "lightning bolt": 1 });
    expect(r.pct).toBe(33);
  });
});
