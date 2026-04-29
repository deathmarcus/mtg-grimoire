import { describe, it, expect } from "vitest";
import {
  computePriceChangePct,
  pickTopMovers,
  aggregateValueByDate,
  filterValueHistoryByRange,
  type SnapshotRow,
  type ValuedItem,
  type ValueHistoryPoint,
} from "./dashboard";

describe("computePriceChangePct", () => {
  it("returns null when previous is null", () => {
    expect(computePriceChangePct(10, null)).toBe(null);
  });

  it("returns null when previous is zero (would divide by zero)", () => {
    expect(computePriceChangePct(10, 0)).toBe(null);
  });

  it("returns null when latest is null", () => {
    expect(computePriceChangePct(null, 10)).toBe(null);
  });

  it("computes positive change", () => {
    expect(computePriceChangePct(12, 10)).toBeCloseTo(20, 5);
  });

  it("computes negative change", () => {
    expect(computePriceChangePct(8, 10)).toBeCloseTo(-20, 5);
  });

  it("returns 0 when prices match", () => {
    expect(computePriceChangePct(10, 10)).toBe(0);
  });
});

describe("pickTopMovers", () => {
  const mk = (id: string, change: number | null) => ({
    cardId: id,
    name: id,
    setCode: "set",
    latestUsd: 10,
    changePct: change,
  });

  it("returns empty when input empty", () => {
    expect(pickTopMovers([], 5)).toEqual([]);
  });

  it("filters out null changePct", () => {
    const movers = pickTopMovers([mk("a", null), mk("b", 5)], 5);
    expect(movers.map((m) => m.cardId)).toEqual(["b"]);
  });

  it("sorts by abs change desc", () => {
    const movers = pickTopMovers(
      [mk("a", 3), mk("b", -10), mk("c", 7), mk("d", -1)],
      5,
    );
    expect(movers.map((m) => m.cardId)).toEqual(["b", "c", "a", "d"]);
  });

  it("respects limit", () => {
    const movers = pickTopMovers(
      [mk("a", 3), mk("b", -10), mk("c", 7)],
      2,
    );
    expect(movers.map((m) => m.cardId)).toEqual(["b", "c"]);
  });
});

describe("aggregateValueByDate", () => {
  const day = (s: string) => new Date(`${s}T00:00:00Z`);

  const items: ValuedItem[] = [
    { cardId: "card1", quantity: 2, foil: "NORMAL", excluded: false },
    { cardId: "card2", quantity: 1, foil: "FOIL", excluded: false },
  ];

  it("returns empty when no snapshots", () => {
    expect(aggregateValueByDate(items, [])).toEqual([]);
  });

  it("sums qty*price per date across items", () => {
    const snapshots: SnapshotRow[] = [
      { cardId: "card1", snapshotDate: day("2026-04-01"), priceUsd: 5, priceUsdFoil: null, priceUsdEtched: null },
      { cardId: "card2", snapshotDate: day("2026-04-01"), priceUsd: null, priceUsdFoil: 20, priceUsdEtched: null },
      { cardId: "card1", snapshotDate: day("2026-04-08"), priceUsd: 6, priceUsdFoil: null, priceUsdEtched: null },
      { cardId: "card2", snapshotDate: day("2026-04-08"), priceUsd: null, priceUsdFoil: 22, priceUsdEtched: null },
    ];
    const result = aggregateValueByDate(items, snapshots);
    expect(result).toEqual([
      { date: "2026-04-01", value: 30 }, // 2*5 + 1*20
      { date: "2026-04-08", value: 34 }, // 2*6 + 1*22
    ]);
  });

  it("excludes items flagged as excluded", () => {
    const itemsMixed: ValuedItem[] = [
      { cardId: "card1", quantity: 2, foil: "NORMAL", excluded: false },
      { cardId: "card2", quantity: 1, foil: "NORMAL", excluded: true },
    ];
    const snapshots: SnapshotRow[] = [
      { cardId: "card1", snapshotDate: day("2026-04-01"), priceUsd: 5, priceUsdFoil: null, priceUsdEtched: null },
      { cardId: "card2", snapshotDate: day("2026-04-01"), priceUsd: 100, priceUsdFoil: null, priceUsdEtched: null },
    ];
    expect(aggregateValueByDate(itemsMixed, snapshots)).toEqual([
      { date: "2026-04-01", value: 10 },
    ]);
  });

  it("falls back to normal price when foil price missing", () => {
    const it: ValuedItem[] = [
      { cardId: "card1", quantity: 1, foil: "FOIL", excluded: false },
    ];
    const snapshots: SnapshotRow[] = [
      { cardId: "card1", snapshotDate: day("2026-04-01"), priceUsd: 7, priceUsdFoil: null, priceUsdEtched: null },
    ];
    expect(aggregateValueByDate(it, snapshots)).toEqual([
      { date: "2026-04-01", value: 7 },
    ]);
  });

  it("sorts dates ascending", () => {
    const snapshots: SnapshotRow[] = [
      { cardId: "card1", snapshotDate: day("2026-04-08"), priceUsd: 5, priceUsdFoil: null, priceUsdEtched: null },
      { cardId: "card1", snapshotDate: day("2026-04-01"), priceUsd: 5, priceUsdFoil: null, priceUsdEtched: null },
    ];
    const result = aggregateValueByDate(
      [{ cardId: "card1", quantity: 1, foil: "NORMAL", excluded: false }],
      snapshots,
    );
    expect(result.map((r) => r.date)).toEqual(["2026-04-01", "2026-04-08"]);
  });
});

describe("filterValueHistoryByRange", () => {
  const mk = (date: string, value: number): ValueHistoryPoint => ({ date, value });
  const now = new Date("2026-04-27T00:00:00Z");

  const history: ValueHistoryPoint[] = [
    mk("2025-04-01", 100),
    mk("2025-10-01", 200),
    mk("2026-01-01", 300),
    mk("2026-03-01", 400),
    mk("2026-04-15", 500),
    mk("2026-04-25", 600),
  ];

  it("range='all' returns full history", () => {
    expect(filterValueHistoryByRange(history, "all", now)).toEqual(history);
  });

  it("range='1m' returns last 30 days", () => {
    const result = filterValueHistoryByRange(history, "1m", now);
    expect(result.map((p) => p.date)).toEqual(["2026-04-15", "2026-04-25"]);
  });

  it("range='3m' returns last 90 days", () => {
    const result = filterValueHistoryByRange(history, "3m", now);
    expect(result.map((p) => p.date)).toEqual([
      "2026-03-01",
      "2026-04-15",
      "2026-04-25",
    ]);
  });

  it("range='6m' returns last 180 days", () => {
    const result = filterValueHistoryByRange(history, "6m", now);
    expect(result.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-03-01",
      "2026-04-15",
      "2026-04-25",
    ]);
  });

  it("range='1y' returns last 365 days", () => {
    const result = filterValueHistoryByRange(history, "1y", now);
    expect(result.length).toBe(5);
    expect(result[0].date).toBe("2025-10-01");
  });

  it("returns empty when no history within range", () => {
    expect(filterValueHistoryByRange([mk("2024-01-01", 1)], "1m", now)).toEqual([]);
  });
});
