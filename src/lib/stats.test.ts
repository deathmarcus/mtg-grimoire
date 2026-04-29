import { describe, it, expect } from "vitest";
import {
  getColorDistribution,
  getRarityDistribution,
  getMostValuableItems,
  type ColorDistributionInput,
  type RarityDistributionInput,
  type ValuableItem,
} from "./stats";

// ---------------------------------------------------------------------------
// getColorDistribution
// ---------------------------------------------------------------------------

describe("getColorDistribution", () => {
  it("returns empty array for empty input", () => {
    expect(getColorDistribution([])).toEqual([]);
  });

  it("groups single-color card correctly", () => {
    const items: ColorDistributionInput[] = [
      { colorIdentity: ["R"], latestUsd: 10, quantity: 2 },
    ];
    const result = getColorDistribution(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ color: "R", totalValue: 20, count: 1 });
  });

  it("maps multicolor (>1 color) to 'M'", () => {
    const items: ColorDistributionInput[] = [
      { colorIdentity: ["U", "W"], latestUsd: 5, quantity: 1 },
    ];
    const result = getColorDistribution(items);
    expect(result[0].color).toBe("M");
  });

  it("maps colorless (empty colorIdentity) to 'C'", () => {
    const items: ColorDistributionInput[] = [
      { colorIdentity: [], latestUsd: 3, quantity: 4 },
    ];
    const result = getColorDistribution(items);
    expect(result[0].color).toBe("C");
  });

  it("aggregates multiple cards of same color", () => {
    const items: ColorDistributionInput[] = [
      { colorIdentity: ["G"], latestUsd: 2, quantity: 3 },
      { colorIdentity: ["G"], latestUsd: 8, quantity: 1 },
    ];
    const result = getColorDistribution(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ color: "G", totalValue: 14, count: 2 });
  });

  it("sorts by totalValue descending", () => {
    const items: ColorDistributionInput[] = [
      { colorIdentity: ["B"], latestUsd: 1, quantity: 1 },
      { colorIdentity: ["R"], latestUsd: 10, quantity: 2 },
      { colorIdentity: ["U"], latestUsd: 5, quantity: 1 },
    ];
    const result = getColorDistribution(items);
    expect(result[0].color).toBe("R");
    expect(result[1].color).toBe("U");
    expect(result[2].color).toBe("B");
  });

  it("handles null latestUsd as zero value contribution", () => {
    const items: ColorDistributionInput[] = [
      { colorIdentity: ["W"], latestUsd: null, quantity: 2 },
    ];
    const result = getColorDistribution(items);
    expect(result[0]).toMatchObject({ color: "W", totalValue: 0, count: 1 });
  });
});

// ---------------------------------------------------------------------------
// getRarityDistribution
// ---------------------------------------------------------------------------

describe("getRarityDistribution", () => {
  it("returns empty array for empty input", () => {
    expect(getRarityDistribution([])).toEqual([]);
  });

  it("computes percentages that sum to 100", () => {
    const items: RarityDistributionInput[] = [
      { rarity: "common" },
      { rarity: "uncommon" },
      { rarity: "rare" },
      { rarity: "mythic" },
    ];
    const result = getRarityDistribution(items);
    const total = result.reduce((s, r) => s + r.pct, 0);
    expect(total).toBeCloseTo(100, 5);
  });

  it("returns rarities in canonical order: mythic > rare > uncommon > common", () => {
    const items: RarityDistributionInput[] = [
      { rarity: "common" },
      { rarity: "rare" },
      { rarity: "uncommon" },
      { rarity: "mythic" },
    ];
    const result = getRarityDistribution(items);
    const order = result.map((r) => r.rarity);
    const mythicIdx = order.indexOf("mythic");
    const rareIdx = order.indexOf("rare");
    const uncommonIdx = order.indexOf("uncommon");
    const commonIdx = order.indexOf("common");
    expect(mythicIdx).toBeLessThan(rareIdx);
    expect(rareIdx).toBeLessThan(uncommonIdx);
    expect(uncommonIdx).toBeLessThan(commonIdx);
  });

  it("groups counts correctly", () => {
    const items: RarityDistributionInput[] = [
      { rarity: "common" },
      { rarity: "common" },
      { rarity: "rare" },
    ];
    const result = getRarityDistribution(items);
    const common = result.find((r) => r.rarity === "common");
    const rare = result.find((r) => r.rarity === "rare");
    expect(common?.count).toBe(2);
    expect(rare?.count).toBe(1);
  });

  it("handles single rarity with 100% percentage", () => {
    const items: RarityDistributionInput[] = [
      { rarity: "mythic" },
      { rarity: "mythic" },
    ];
    const result = getRarityDistribution(items);
    expect(result).toHaveLength(1);
    expect(result[0].pct).toBeCloseTo(100, 5);
  });
});

// ---------------------------------------------------------------------------
// getMostValuableItems
// ---------------------------------------------------------------------------

describe("getMostValuableItems", () => {
  it("returns empty array for empty input", () => {
    expect(getMostValuableItems([], 10)).toEqual([]);
  });

  it("sorts by latestUsd * quantity descending", () => {
    const items: ValuableItem[] = [
      { id: "a", cardId: "c-a", latestUsd: 1, quantity: 10 },
      { id: "b", cardId: "c-b", latestUsd: 50, quantity: 1 },
      { id: "c", cardId: "c-c", latestUsd: 5, quantity: 4 },
    ];
    const result = getMostValuableItems(items, 10);
    expect(result[0].id).toBe("b"); // 50
    expect(result[1].id).toBe("c"); // 20
    expect(result[2].id).toBe("a"); // 10
  });

  it("respects the limit parameter", () => {
    const items: ValuableItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: `card-${i}`,
      cardId: `c-${i}`,
      latestUsd: i,
      quantity: 1,
    }));
    const result = getMostValuableItems(items, 5);
    expect(result).toHaveLength(5);
  });

  it("handles null latestUsd as zero for sorting", () => {
    const items: ValuableItem[] = [
      { id: "a", cardId: "c-a", latestUsd: null, quantity: 5 },
      { id: "b", cardId: "c-b", latestUsd: 2, quantity: 1 },
    ];
    const result = getMostValuableItems(items, 10);
    expect(result[0].id).toBe("b");
  });
});
