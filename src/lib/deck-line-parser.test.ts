import { describe, it, expect } from "vitest";
import { parseDeckLine } from "./deck-line-parser";

describe("parseDeckLine", () => {
  it("parses a valid line", () => {
    expect(parseDeckLine("1 Sol Ring (cmr) 385")).toEqual({
      quantity: 1,
      name: "Sol Ring",
      setCode: "cmr",
      collectorNumber: "385",
    });
  });

  it("parses a multi-digit quantity", () => {
    expect(parseDeckLine("12 Forest (znr) 278")).toEqual({
      quantity: 12,
      name: "Forest",
      setCode: "znr",
      collectorNumber: "278",
    });
  });

  it("handles a name with internal parentheses by backtracking to the real set group", () => {
    expect(parseDeckLine("1 Question Mark (?) (MH2) 278")).toEqual({
      quantity: 1,
      name: "Question Mark (?)",
      setCode: "MH2",
      collectorNumber: "278",
    });
  });

  it("handles split cards with // in the name", () => {
    expect(parseDeckLine("1 Fire // Ice (apc) 123")).toEqual({
      quantity: 1,
      name: "Fire // Ice",
      setCode: "apc",
      collectorNumber: "123",
    });
  });

  it("returns null for a line without set/collector number (current behavior)", () => {
    expect(parseDeckLine("Lightning Bolt")).toBeNull();
  });

  it("returns null for an empty line", () => {
    expect(parseDeckLine("")).toBeNull();
  });

  it("returns null for a comment line", () => {
    expect(parseDeckLine("// Commander")).toBeNull();
  });

  it("handles collector numbers with trailing letters (promo variants)", () => {
    expect(parseDeckLine("1 Forest (ZNR) 278a")).toEqual({
      quantity: 1,
      name: "Forest",
      setCode: "ZNR",
      collectorNumber: "278a",
    });
  });
});
