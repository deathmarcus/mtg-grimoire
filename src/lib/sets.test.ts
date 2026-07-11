import { describe, it, expect } from "vitest";
import {
  compareCollectorNumbers,
  computeSetProgress,
  mapSetSummaryRow,
  sortSetSummaries,
  type SetSummary,
  type SetSummaryRawRow,
} from "./sets";

describe("compareCollectorNumbers", () => {
  it("orders plain numeric strings numerically, not lexicographically", () => {
    expect(compareCollectorNumbers("2", "10")).toBeLessThan(0);
    expect(compareCollectorNumbers("10", "2")).toBeGreaterThan(0);
    expect(compareCollectorNumbers("9", "9")).toBe(0);
  });

  it("orders numeric prefixes with alphabetic suffixes after the plain number", () => {
    expect(compareCollectorNumbers("10", "10a")).toBeLessThan(0);
    expect(compareCollectorNumbers("10a", "10")).toBeGreaterThan(0);
    expect(compareCollectorNumbers("10a", "10b")).toBeLessThan(0);
    expect(compareCollectorNumbers("10b", "10a")).toBeGreaterThan(0);
  });

  it("keeps numeric ordering across the alphabetic-suffix boundary", () => {
    expect(compareCollectorNumbers("9", "10a")).toBeLessThan(0);
    expect(compareCollectorNumbers("11", "10a")).toBeGreaterThan(0);
  });

  it("sorts fully non-numeric collector numbers (symbols) after numeric ones", () => {
    expect(compareCollectorNumbers("123", "★")).toBeLessThan(0);
    expect(compareCollectorNumbers("★", "123")).toBeGreaterThan(0);
  });

  it("falls back to string comparison among non-numeric collector numbers", () => {
    expect(compareCollectorNumbers("★", "★1")).toBeLessThan(0);
  });

  it("is stable (zero) for identical values", () => {
    expect(compareCollectorNumbers("42a", "42a")).toBe(0);
  });
});

describe("computeSetProgress", () => {
  it("computes an integer percentage", () => {
    expect(computeSetProgress({ total: 200, owned: 50 })).toEqual({
      total: 200,
      owned: 50,
      pct: 25,
    });
  });

  it("rounds to the nearest integer", () => {
    expect(computeSetProgress({ total: 3, owned: 1 }).pct).toBe(33);
    expect(computeSetProgress({ total: 3, owned: 2 }).pct).toBe(67);
  });

  it("returns 0 pct when total is 0 (no division by zero)", () => {
    expect(computeSetProgress({ total: 0, owned: 0 })).toEqual({
      total: 0,
      owned: 0,
      pct: 0,
    });
  });

  it("clamps owned to total defensively when owned > total", () => {
    expect(computeSetProgress({ total: 10, owned: 15 })).toEqual({
      total: 10,
      owned: 10,
      pct: 100,
    });
  });

  it("clamps pct to 0..100", () => {
    expect(computeSetProgress({ total: 10, owned: -3 }).pct).toBe(0);
  });
});

describe("mapSetSummaryRow", () => {
  it("converts raw SQL row (bigint-as-string counts, Decimal value) into a view model", () => {
    const raw: SetSummaryRawRow = {
      setCode: "neo",
      setName: "Kamigawa: Neon Dynasty",
      setType: "expansion",
      releasedAt: new Date("2022-02-18T00:00:00.000Z"),
      total: 5n,
      owned: 3n,
      ownedValueUsd: "123.45",
    };
    expect(mapSetSummaryRow(raw)).toEqual({
      setCode: "neo",
      setName: "Kamigawa: Neon Dynasty",
      setType: "expansion",
      releasedAt: raw.releasedAt,
      total: 5,
      owned: 3,
      pct: 60,
      ownedValueUsd: 123.45,
    });
  });

});

describe("sortSetSummaries", () => {
  const mk = (setCode: string, releasedAt: string | null, pct: number): SetSummary => ({
    setCode,
    setName: setCode,
    setType: "expansion",
    releasedAt: releasedAt ? new Date(releasedAt) : null,
    total: 100,
    owned: pct,
    pct,
    ownedValueUsd: 0,
  });

  it("sorts by release date desc by default", () => {
    const sets = [mk("a", "2020-01-01", 10), mk("b", "2022-01-01", 5), mk("c", "2021-01-01", 90)];
    expect(sortSetSummaries(sets, "date").map((s) => s.setCode)).toEqual(["b", "c", "a"]);
  });

  it("puts sets without a release date last when sorting by date", () => {
    const sets = [mk("a", null, 10), mk("b", "2022-01-01", 5)];
    expect(sortSetSummaries(sets, "date").map((s) => s.setCode)).toEqual(["b", "a"]);
  });

  it("sorts by progress desc, breaking ties by release date desc", () => {
    const sets = [mk("a", "2020-01-01", 50), mk("b", "2022-01-01", 90), mk("c", "2021-01-01", 90)];
    expect(sortSetSummaries(sets, "progress").map((s) => s.setCode)).toEqual(["b", "c", "a"]);
  });
});

describe("mapSetSummaryRow — extra", () => {
  it("handles null releasedAt and null value sum", () => {
    const raw: SetSummaryRawRow = {
      setCode: "abc",
      setName: "Some Set",
      setType: "core",
      releasedAt: null,
      total: 10n,
      owned: 0n,
      ownedValueUsd: null,
    };
    expect(mapSetSummaryRow(raw)).toEqual({
      setCode: "abc",
      setName: "Some Set",
      setType: "core",
      releasedAt: null,
      total: 10,
      owned: 0,
      pct: 0,
      ownedValueUsd: 0,
    });
  });
});
