import { describe, expect, test } from "vitest";
import {
  parseColorsParam,
  toggleColor,
  parseRarityParam,
  parseSortParam,
  rarityOrder,
} from "./collection-filters";

describe("parseColorsParam", () => {
  test("returns empty array for null/undefined/empty", () => {
    expect(parseColorsParam(null)).toEqual([]);
    expect(parseColorsParam(undefined)).toEqual([]);
    expect(parseColorsParam("")).toEqual([]);
  });

  test("parses comma-separated colors uppercase", () => {
    expect(parseColorsParam("W,U,B")).toEqual(["W", "U", "B"]);
  });

  test("normalizes lowercase to uppercase", () => {
    expect(parseColorsParam("w,u")).toEqual(["W", "U"]);
  });

  test("filters out invalid letters and dedupes", () => {
    expect(parseColorsParam("W,X,W,U,Q")).toEqual(["W", "U"]);
  });

  test("preserves W U B R G C as valid", () => {
    expect(parseColorsParam("W,U,B,R,G,C")).toEqual(["W", "U", "B", "R", "G", "C"]);
  });
});

describe("toggleColor", () => {
  test("adds color when absent", () => {
    expect(toggleColor(["W"], "U")).toEqual(["W", "U"]);
  });

  test("removes color when present", () => {
    expect(toggleColor(["W", "U"], "W")).toEqual(["U"]);
  });

  test("preserves order when adding", () => {
    expect(toggleColor(["U", "B"], "W")).toEqual(["U", "B", "W"]);
  });
});

describe("parseRarityParam", () => {
  test("returns null for invalid or absent", () => {
    expect(parseRarityParam(null)).toBeNull();
    expect(parseRarityParam(undefined)).toBeNull();
    expect(parseRarityParam("")).toBeNull();
    expect(parseRarityParam("garbage")).toBeNull();
    expect(parseRarityParam("all")).toBeNull();
  });

  test("returns valid rarity normalized to lowercase", () => {
    expect(parseRarityParam("common")).toBe("common");
    expect(parseRarityParam("UNCOMMON")).toBe("uncommon");
    expect(parseRarityParam("Rare")).toBe("rare");
    expect(parseRarityParam("mythic")).toBe("mythic");
  });
});

describe("parseSortParam", () => {
  test("defaults to name", () => {
    expect(parseSortParam(null)).toBe("name");
    expect(parseSortParam(undefined)).toBe("name");
    expect(parseSortParam("")).toBe("name");
    expect(parseSortParam("garbage")).toBe("name");
  });

  test("accepts price, name, rarity", () => {
    expect(parseSortParam("price")).toBe("price");
    expect(parseSortParam("name")).toBe("name");
    expect(parseSortParam("rarity")).toBe("rarity");
  });
});

describe("rarityOrder", () => {
  test("mythic comes first", () => {
    expect(rarityOrder("mythic")).toBeLessThan(rarityOrder("rare"));
  });

  test("rare beats uncommon and common", () => {
    expect(rarityOrder("rare")).toBeLessThan(rarityOrder("uncommon"));
    expect(rarityOrder("uncommon")).toBeLessThan(rarityOrder("common"));
  });

  test("unknown rarity sorts last", () => {
    expect(rarityOrder("unknown")).toBeGreaterThan(rarityOrder("common"));
  });
});
