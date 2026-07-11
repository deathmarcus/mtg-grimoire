import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    card: { findMany: vi.fn() },
    collectionItem: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { itemKey, enrichRows, loadCardsAndExistingItems } from "./import-preview";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("itemKey", () => {
  it("builds a stable composite key", () => {
    expect(itemKey("card-1", "FOIL", "en", "NM")).toBe("card-1|FOIL|en|NM");
  });
});

describe("enrichRows", () => {
  const cards = [{ id: "card-1", name: "Lightning Bolt", imageSmall: "img.png", latestUsd: "1.23" }];

  it("marks unmatched rows (null cardId) as not matched with zero existing quantity", () => {
    const [row] = enrichRows([{ cardId: null, foil: "NORMAL", language: "en", condition: "NM" }], cards, []);
    expect(row).toEqual({
      matched: false,
      existingQuantity: 0,
      cardName: null,
      imageSmall: null,
      latestUsd: null,
    });
  });

  it("marks matched rows with card info and existing quantity from existingItems", () => {
    const existingItems = [{ cardId: "card-1", foil: "NORMAL", language: "en", condition: "NM", quantity: 4 }];
    const [row] = enrichRows(
      [{ cardId: "card-1", foil: "NORMAL", language: "en", condition: "NM" }],
      cards,
      existingItems,
    );
    expect(row).toEqual({
      matched: true,
      existingQuantity: 4,
      cardName: "Lightning Bolt",
      imageSmall: "img.png",
      latestUsd: "1.23",
    });
  });

  it("returns 0 existing quantity for a matched card with no existing item in this variant", () => {
    const existingItems = [{ cardId: "card-1", foil: "FOIL", language: "en", condition: "NM", quantity: 4 }];
    const [row] = enrichRows(
      [{ cardId: "card-1", foil: "NORMAL", language: "en", condition: "NM" }],
      cards,
      existingItems,
    );
    expect(row.existingQuantity).toBe(0);
  });
});

describe("loadCardsAndExistingItems", () => {
  it("returns empty arrays without querying when there are no ids", async () => {
    const result = await loadCardsAndExistingItems("user-1", []);
    expect(result).toEqual({ cards: [], existingItems: [] });
    expect(mockPrisma.card.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.collectionItem.findMany).not.toHaveBeenCalled();
  });

  it("queries cards and existing items scoped to the user and given ids", async () => {
    mockPrisma.card.findMany.mockResolvedValue([{ id: "card-1", name: "Bolt", imageSmall: null, latestUsd: null }]);
    mockPrisma.collectionItem.findMany.mockResolvedValue([]);
    const result = await loadCardsAndExistingItems("user-1", ["card-1"]);
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["card-1"] } } }),
    );
    expect(mockPrisma.collectionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1", cardId: { in: ["card-1"] } } }),
    );
    expect(result.cards).toHaveLength(1);
  });
});
