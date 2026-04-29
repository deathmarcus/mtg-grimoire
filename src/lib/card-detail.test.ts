import { describe, it, expect } from "vitest";
import {
  parseLegalities,
  formatLegalityStatus,
  PRIMARY_FORMATS,
  type Legality,
} from "./card-detail";

describe("parseLegalities", () => {
  it("returns empty array on null", () => {
    expect(parseLegalities(null)).toEqual([]);
  });

  it("returns empty array on garbage input", () => {
    expect(parseLegalities("not json")).toEqual([]);
    expect(parseLegalities(42)).toEqual([]);
    expect(parseLegalities([])).toEqual([]);
  });

  it("ignores non-string status values", () => {
    const result = parseLegalities({ standard: 1, modern: "legal" });
    expect(result.find((l) => l.format === "standard")).toBeUndefined();
    expect(result.find((l) => l.format === "modern")?.status).toBe("legal");
  });

  it("orders primary formats first in PRIMARY_FORMATS order", () => {
    const result = parseLegalities({
      vintage: "legal",
      standard: "legal",
      pauper: "legal",
      commander: "legal",
    });
    const formats = result.map((l) => l.format);
    const standardIdx = formats.indexOf("standard");
    const commanderIdx = formats.indexOf("commander");
    const vintageIdx = formats.indexOf("vintage");
    expect(standardIdx).toBeLessThan(commanderIdx);
    expect(commanderIdx).toBeLessThan(vintageIdx);
  });

  it("appends non-primary formats alphabetically after primary", () => {
    const result = parseLegalities({
      pauper: "legal",
      modern: "legal",
      alchemy: "legal",
      explorer: "legal",
    });
    const formats = result.map((l) => l.format);
    expect(formats.indexOf("modern")).toBeLessThan(formats.indexOf("alchemy"));
    expect(formats.indexOf("alchemy")).toBeLessThan(formats.indexOf("explorer"));
  });

  it("normalizes status to canonical Legality.status", () => {
    const result = parseLegalities({
      standard: "legal",
      modern: "not_legal",
      pauper: "banned",
      vintage: "restricted",
    });
    const byFormat = Object.fromEntries(result.map((l) => [l.format, l.status]));
    expect(byFormat.standard).toBe("legal");
    expect(byFormat.modern).toBe("not_legal");
    expect(byFormat.pauper).toBe("banned");
    expect(byFormat.vintage).toBe("restricted");
  });

  it("falls back to not_legal for unknown status strings", () => {
    const result = parseLegalities({ standard: "wat" });
    expect(result[0].status).toBe("not_legal");
  });
});

describe("formatLegalityStatus", () => {
  const cases: Array<[Legality["status"], string]> = [
    ["legal", "Legal"],
    ["not_legal", "Not legal"],
    ["banned", "Banned"],
    ["restricted", "Restricted"],
  ];
  for (const [input, expected] of cases) {
    it(`maps "${input}" to "${expected}"`, () => {
      expect(formatLegalityStatus(input)).toBe(expected);
    });
  }
});

describe("PRIMARY_FORMATS contract", () => {
  it("starts with standard and includes commander", () => {
    expect(PRIMARY_FORMATS[0]).toBe("standard");
    expect(PRIMARY_FORMATS).toContain("commander");
  });
});
