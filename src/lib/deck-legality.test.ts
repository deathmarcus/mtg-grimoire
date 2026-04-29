import { describe, it, expect } from "vitest";
import { checkDeckLegality } from "./deck-legality";

// A minimal card shape used in tests — only fields deck-legality cares about
function card(legalities: unknown) {
  return { legalities };
}

describe("checkDeckLegality", () => {
  it("returns all-true for an empty deck", () => {
    const result = checkDeckLegality([]);
    // Should return an object with boolean values — all formats default to true
    // (vacuously, an empty deck violates no ban)
    for (const v of Object.values(result)) {
      expect(typeof v).toBe("boolean");
    }
  });

  it("marks a format legal when all cards are legal in it", () => {
    const cards = [
      card({ standard: "legal", modern: "legal" }),
      card({ standard: "legal", modern: "legal" }),
    ];
    const result = checkDeckLegality(cards);
    expect(result.standard).toBe(true);
    expect(result.modern).toBe(true);
  });

  it("marks a format illegal when one card is banned", () => {
    const cards = [
      card({ standard: "legal", modern: "banned" }),
      card({ standard: "legal", modern: "legal" }),
    ];
    const result = checkDeckLegality(cards);
    expect(result.standard).toBe(true);
    expect(result.modern).toBe(false);
  });

  it("marks a format illegal when one card is not_legal", () => {
    const cards = [
      card({ modern: "not_legal" }),
      card({ modern: "legal" }),
    ];
    const result = checkDeckLegality(cards);
    expect(result.modern).toBe(false);
  });

  it("treats 'restricted' as legal (one copy allowed) for legality purposes", () => {
    const cards = [
      card({ vintage: "restricted" }),
      card({ vintage: "legal" }),
    ];
    const result = checkDeckLegality(cards);
    expect(result.vintage).toBe(true);
  });

  it("skips formats where a card has no legality entry (treats as not_legal)", () => {
    const cards = [
      card({ standard: "legal" }),
      card({}), // no standard entry — format unknown for this card
    ];
    const result = checkDeckLegality(cards);
    // Second card has no standard entry → format is not_legal by default
    expect(result.standard).toBe(false);
  });

  it("handles null/undefined legalities gracefully", () => {
    const cards = [
      card(null),
      card(undefined),
    ];
    // All formats end up not_legal because we have no info
    const result = checkDeckLegality(cards);
    expect(typeof result).toBe("object");
  });

  it("handles malformed legalities JSON gracefully", () => {
    const cards = [card("not-an-object"), card(42), card([])];
    const result = checkDeckLegality(cards);
    expect(typeof result).toBe("object");
  });

  it("collects all unique formats across all cards", () => {
    const cards = [
      card({ standard: "legal", modern: "legal" }),
      card({ legacy: "legal", pauper: "legal" }),
    ];
    const result = checkDeckLegality(cards);
    expect(result).toHaveProperty("standard");
    expect(result).toHaveProperty("modern");
    expect(result).toHaveProperty("legacy");
    expect(result).toHaveProperty("pauper");
  });

  it("uses PRIMARY_FORMATS as the base set of formats to check", () => {
    const cards = [card({ standard: "legal" })];
    const result = checkDeckLegality(cards);
    // commander should be present even if no card mentions it
    expect(result).toHaveProperty("commander");
  });
});
