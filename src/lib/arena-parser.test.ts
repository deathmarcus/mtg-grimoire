import { describe, it, expect } from "vitest";
import { parseArenaTxt } from "./arena-parser";

describe("parseArenaTxt", () => {
  it("parses a single line", () => {
    const result = parseArenaTxt("4 Lightning Bolt (M11) 149");
    expect(result).toEqual([
      { name: "Lightning Bolt", setCode: "M11", collectorNumber: "149", quantity: 4 },
    ]);
  });

  it("parses multiple lines", () => {
    const result = parseArenaTxt(
      "2 Counterspell (TSR) 63\n1 Sol Ring (C21) 263"
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: "Counterspell", quantity: 2 });
    expect(result[1]).toMatchObject({ name: "Sol Ring", quantity: 1 });
  });

  it("ignores Deck header line", () => {
    const result = parseArenaTxt("Deck\n4 Lightning Bolt (M11) 149");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Lightning Bolt");
  });

  it("ignores Sideboard header line", () => {
    const result = parseArenaTxt(
      "4 Lightning Bolt (M11) 149\nSideboard\n2 Pyroblast (A25) 153"
    );
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Pyroblast");
  });

  it("ignores comment lines starting with //", () => {
    const result = parseArenaTxt(
      "// This is a deck\n4 Lightning Bolt (M11) 149"
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Lightning Bolt");
  });

  it("ignores empty lines", () => {
    const result = parseArenaTxt(
      "\n4 Lightning Bolt (M11) 149\n\n1 Sol Ring (C21) 263\n"
    );
    expect(result).toHaveLength(2);
  });

  it("handles 4-letter set codes", () => {
    const result = parseArenaTxt("1 Ragavan, Nimble Pilferer (MH21) 138");
    expect(result).toEqual([
      { name: "Ragavan, Nimble Pilferer", setCode: "MH21", collectorNumber: "138", quantity: 1 },
    ]);
  });

  it("handles quantity > 1", () => {
    const result = parseArenaTxt("4 Thoughtseize (THS) 107");
    expect(result[0].quantity).toBe(4);
  });

  it("ignores malformed lines (no set/collector number)", () => {
    const result = parseArenaTxt("Lightning Bolt");
    expect(result).toHaveLength(0);
  });

  it("returns empty array when all lines are malformed", () => {
    const result = parseArenaTxt("garbage\n???\nnot a card");
    expect(result).toHaveLength(0);
  });

  it("parses mixed valid and invalid lines", () => {
    const result = parseArenaTxt(
      "4 Lightning Bolt (M11) 149\nbad line\n2 Counterspell (TSR) 63"
    );
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Lightning Bolt");
    expect(result[1].name).toBe("Counterspell");
  });

  it("trims whitespace from card names", () => {
    const result = parseArenaTxt("1 Wrenn and Six (MH1) 217");
    expect(result[0].name).toBe("Wrenn and Six");
  });

  it("handles collector numbers with letters (promo variants)", () => {
    const result = parseArenaTxt("1 Forest (ZNR) 278a");
    expect(result[0].collectorNumber).toBe("278a");
  });
});
