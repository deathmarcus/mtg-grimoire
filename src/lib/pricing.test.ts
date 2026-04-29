import { describe, it, expect } from "vitest";
import {
  pickPriceForFinish,
  aggregateCollectionValue,
  sparklineScale,
} from "./pricing";

const mkCard = (overrides: Partial<Record<string, unknown>> = {}) => ({
  latestUsd: "10.00",
  latestUsdFoil: "25.00",
  latestUsdEtched: "40.00",
  ...overrides,
});

describe("pickPriceForFinish", () => {
  it("returns normal price for NORMAL finish", () => {
    expect(pickPriceForFinish(mkCard(), "NORMAL")).toBe(10);
  });

  it("returns foil price for FOIL finish", () => {
    expect(pickPriceForFinish(mkCard(), "FOIL")).toBe(25);
  });

  it("returns etched price for ETCHED finish", () => {
    expect(pickPriceForFinish(mkCard(), "ETCHED")).toBe(40);
  });

  it("falls back to normal when foil finish has no price", () => {
    expect(
      pickPriceForFinish(mkCard({ latestUsdFoil: null }), "FOIL"),
    ).toBe(10);
  });

  it("returns null when no price available for finish or fallback", () => {
    expect(
      pickPriceForFinish(
        { latestUsd: null, latestUsdFoil: null, latestUsdEtched: null },
        "NORMAL",
      ),
    ).toBeNull();
  });

  it("accepts Decimal-like objects via toString", () => {
    const dec = { toString: () => "3.14", valueOf: () => 3.14 };
    expect(pickPriceForFinish({ latestUsd: dec }, "NORMAL")).toBe(3.14);
  });
});

describe("aggregateCollectionValue", () => {
  const mk = (
    cardId: string,
    quantity: number,
    foil: "NORMAL" | "FOIL" | "ETCHED",
    excluded: boolean,
    card = mkCard(),
  ) => ({ cardId, quantity, foil, excluded, card });

  it("returns zero aggregates for empty collection", () => {
    const result = aggregateCollectionValue([]);
    expect(result.included).toEqual({ totalUsd: 0, totalCards: 0, uniquePrintings: 0 });
    expect(result.excluded).toEqual({ totalUsd: 0, totalCards: 0, uniquePrintings: 0 });
    expect(result.totalCards).toBe(0);
    expect(result.uniquePrintings).toBe(0);
  });

  it("splits value between included and excluded buckets", () => {
    const items = [
      mk("a", 2, "NORMAL", false),
      mk("b", 1, "FOIL", false),
      mk("c", 3, "NORMAL", true, mkCard({ latestUsd: "5" })),
    ];
    const result = aggregateCollectionValue(items);
    expect(result.included.totalUsd).toBe(2 * 10 + 1 * 25);
    expect(result.included.totalCards).toBe(3);
    expect(result.excluded.totalUsd).toBe(3 * 5);
    expect(result.excluded.totalCards).toBe(3);
  });

  it("counts unique printings by cardId across both buckets", () => {
    // Same cardId "a" in two collections (one included, one excluded) → 1 unique printing.
    const items = [
      mk("a", 2, "NORMAL", false),
      mk("a", 1, "NORMAL", true),
      mk("b", 1, "FOIL", false),
    ];
    const result = aggregateCollectionValue(items);
    expect(result.uniquePrintings).toBe(2);
    expect(result.totalCards).toBe(4);
    expect(result.included.uniquePrintings).toBe(2);
    expect(result.excluded.uniquePrintings).toBe(1);
  });

  it("skips items without a resolvable price in either bucket", () => {
    const items = [
      mk("a", 5, "NORMAL", false, {
        latestUsd: null,
        latestUsdFoil: null,
        latestUsdEtched: null,
      }),
      mk("b", 2, "NORMAL", false),
      mk("c", 1, "NORMAL", true, {
        latestUsd: null,
        latestUsdFoil: null,
        latestUsdEtched: null,
      }),
    ];
    const result = aggregateCollectionValue(items);
    expect(result.included.totalUsd).toBe(20);
    expect(result.included.totalCards).toBe(7);
    expect(result.excluded.totalUsd).toBe(0);
    expect(result.excluded.totalCards).toBe(1);
  });
});

describe("sparklineScale", () => {
  it("returns empty points for empty input", () => {
    expect(sparklineScale([], 100, 40)).toEqual([]);
  });

  it("scales a single point to the middle-left of the box", () => {
    const out = sparklineScale([5], 100, 40);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ x: 0, y: 20 });
  });

  it("scales ascending series within the bounds", () => {
    const out = sparklineScale([1, 2, 3, 4], 90, 40);
    // x values should be 0, 30, 60, 90
    expect(out.map((p) => p.x)).toEqual([0, 30, 60, 90]);
    // y: highest value (4) → y=0 (top), lowest (1) → y=40 (bottom)
    expect(out[0].y).toBe(40);
    expect(out[3].y).toBe(0);
  });

  it("handles a flat series by placing everything at vertical center", () => {
    const out = sparklineScale([7, 7, 7], 60, 40);
    expect(out.map((p) => p.y)).toEqual([20, 20, 20]);
    expect(out.map((p) => p.x)).toEqual([0, 30, 60]);
  });
});
