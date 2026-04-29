import { describe, it, expect } from "vitest";
import { computeGap, targetPriceProgress } from "./wishlist-helpers";

describe("computeGap", () => {
  it("returns null when currentUsd is null", () => {
    expect(computeGap(null, 10)).toBeNull();
  });

  it("returns null when maxPriceUsd is null", () => {
    expect(computeGap(25, null)).toBeNull();
  });

  it("returns null when both are null", () => {
    expect(computeGap(null, null)).toBeNull();
  });

  it("returns negative gap when current is below max (good deal)", () => {
    expect(computeGap(20, 30)).toBe(-10);
  });

  it("returns positive gap when current is above max (too expensive)", () => {
    expect(computeGap(35, 30)).toBe(5);
  });

  it("returns zero when current equals max", () => {
    expect(computeGap(30, 30)).toBe(0);
  });
});

describe("targetPriceProgress", () => {
  it("returns null when currentUsd is null", () => {
    expect(targetPriceProgress(null, 10)).toBeNull();
  });

  it("returns null when maxPriceUsd is null", () => {
    expect(targetPriceProgress(25, null)).toBeNull();
  });

  it("returns null when maxPriceUsd is zero", () => {
    expect(targetPriceProgress(25, 0)).toBeNull();
  });

  it("returns reached at 100% when current equals max", () => {
    expect(targetPriceProgress(30, 30)).toEqual({ percent: 100, status: "reached" });
  });

  it("returns reached at 100% when current is below max", () => {
    expect(targetPriceProgress(20, 30)).toEqual({ percent: 100, status: "reached" });
  });

  it("returns close when current is within 20% above max", () => {
    const r = targetPriceProgress(11, 10);
    expect(r?.status).toBe("close");
    expect(r?.percent).toBeCloseTo((10 / 11) * 100);
  });

  it("returns far when current is more than 20% above max", () => {
    const r = targetPriceProgress(15, 10);
    expect(r?.status).toBe("far");
    expect(r?.percent).toBeCloseTo((10 / 15) * 100);
  });

  it("clamps percent to 0–100", () => {
    const r = targetPriceProgress(1000, 10);
    expect(r?.percent).toBeGreaterThanOrEqual(0);
    expect(r?.percent).toBeLessThanOrEqual(100);
  });
});
