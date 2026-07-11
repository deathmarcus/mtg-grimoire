import { describe, it, expect } from "vitest";
import {
  formatPriceProvenance,
  formatFxProvenance,
  latestDate,
} from "./price-provenance";

describe("formatPriceProvenance", () => {
  it("formats a snapshot source in Spanish", () => {
    const out = formatPriceProvenance("snapshot", "2026-07-06T00:00:00.000Z", "es");
    expect(out).toBe("TCGplayer market vía Scryfall · snapshot 2026-07-06");
  });

  it("formats a snapshot source in English", () => {
    const out = formatPriceProvenance("snapshot", "2026-07-06T00:00:00.000Z", "en");
    expect(out).toBe("TCGplayer market via Scryfall · snapshot 2026-07-06");
  });

  it("formats a catalog source in Spanish", () => {
    const out = formatPriceProvenance("catalog", "2026-07-01T00:00:00.000Z", "es");
    expect(out).toBe("TCGplayer market vía Scryfall · catálogo 2026-07-01");
  });

  it("formats a catalog source in English", () => {
    const out = formatPriceProvenance("catalog", "2026-07-01T00:00:00.000Z", "en");
    expect(out).toBe("TCGplayer market via Scryfall · catalog 2026-07-01");
  });

  it("accepts a Date instance", () => {
    const out = formatPriceProvenance("catalog", new Date("2026-07-01T12:34:00.000Z"), "en");
    expect(out).toBe("TCGplayer market via Scryfall · catalog 2026-07-01");
  });

  it("falls back to a no-date label when date is null", () => {
    const out = formatPriceProvenance("catalog", null, "en");
    expect(out).toBe("TCGplayer market via Scryfall · date unavailable");
  });

  it("falls back to a no-date label when date is invalid", () => {
    const out = formatPriceProvenance("catalog", "not-a-date", "es");
    expect(out).toBe("TCGplayer market vía Scryfall · fecha no disponible");
  });
});

describe("formatFxProvenance", () => {
  it("returns null when rate is null", () => {
    expect(formatFxProvenance(null, "2026-07-06", "en")).toBeNull();
  });

  it("returns null when rate is zero or negative", () => {
    expect(formatFxProvenance(0, "2026-07-06", "en")).toBeNull();
    expect(formatFxProvenance(-1, "2026-07-06", "en")).toBeNull();
  });

  it("formats rate + date in English", () => {
    const out = formatFxProvenance(17.326474, "2026-07-06T00:00:00.000Z", "en");
    expect(out).toBe("FX 17.33 MXN/USD · 2026-07-06");
  });

  it("formats rate + date in Spanish", () => {
    const out = formatFxProvenance(17.326474, "2026-07-06T00:00:00.000Z", "es");
    expect(out).toBe("FX 17.33 MXN/USD · 2026-07-06");
  });

  it("uses the no-date label when date is missing", () => {
    const out = formatFxProvenance(17.33, null, "en");
    expect(out).toBe("FX 17.33 MXN/USD · date unavailable");
  });
});

describe("latestDate", () => {
  it("returns null for an empty list", () => {
    expect(latestDate([])).toBeNull();
  });

  it("returns null when every entry is null", () => {
    expect(latestDate([null, null])).toBeNull();
  });

  it("returns the most recent date, ignoring nulls", () => {
    const a = new Date("2026-01-01T00:00:00.000Z");
    const b = new Date("2026-07-01T00:00:00.000Z");
    const c = new Date("2026-03-01T00:00:00.000Z");
    expect(latestDate([a, null, b, c])).toBe(b);
  });
});
