import { describe, it, expect } from "vitest";
import { formatMoney, toNumber } from "./money-format";

describe("formatMoney", () => {
  it("returns em-dash for null/undefined", () => {
    expect(formatMoney(null, "USD", 1)).toBe("—");
    expect(formatMoney(undefined, "MXN", 17)).toBe("—");
  });

  it("formats USD directly with currency label", () => {
    expect(formatMoney(1234.5, "USD", 17)).toBe("$1,234.50 USD");
    expect(formatMoney(0, "USD", 17)).toBe("$0.00 USD");
  });

  it("converts to MXN using provided rate with currency label", () => {
    const out = formatMoney(10, "MXN", 17);
    expect(out).toContain("170");
    expect(out).toMatch(/MXN$/);
  });

  it("handles zero rate gracefully (shows MX$0)", () => {
    const out = formatMoney(100, "MXN", 0);
    expect(out).toContain("0");
    expect(out).toMatch(/MXN$/);
  });
});

describe("toNumber", () => {
  it("returns null for nullish", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });

  it("parses numeric strings", () => {
    expect(toNumber("12.34")).toBe(12.34);
  });

  it("parses Prisma Decimal-like via toString coercion", () => {
    const fake = { toString: () => "42.5", valueOf: () => 42.5 };
    expect(toNumber(fake)).toBe(42.5);
  });

  it("returns null for NaN / garbage", () => {
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(NaN)).toBeNull();
  });
});
