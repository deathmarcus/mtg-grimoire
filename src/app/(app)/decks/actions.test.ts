import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser } = vi.hoisted(() => ({
  mockPrisma: {
    deck: { findFirst: vi.fn() },
    deckCard: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    card: { findUnique: vi.fn() },
  },
  mockRequireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { removeCardFromDeck, updateDeckCard } from "./actions";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
  mockPrisma.deck.findFirst.mockResolvedValue({ id: "deck-1" });
});

describe("removeCardFromDeck — deckCardId bound to deck", () => {
  it("deletes scoped to the verified deckId", async () => {
    mockPrisma.deckCard.deleteMany.mockResolvedValue({ count: 1 });
    const res = await removeCardFromDeck("deck-1", "dc-1");
    expect(res).toEqual({ ok: true });
    expect(mockPrisma.deckCard.deleteMany).toHaveBeenCalledWith({
      where: { id: "dc-1", deckId: "deck-1" },
    });
    expect(mockPrisma.deckCard.delete).not.toHaveBeenCalled();
  });

  it("errors without deleting when the deckCard belongs to another deck", async () => {
    mockPrisma.deckCard.deleteMany.mockResolvedValue({ count: 0 });
    const res = await removeCardFromDeck("deck-1", "dc-foreign");
    expect(res).toEqual({ error: "Card not found in deck" });
  });
});

describe("updateDeckCard — deckCardId bound to deck", () => {
  it("updates scoped to the verified deckId", async () => {
    mockPrisma.deckCard.updateMany.mockResolvedValue({ count: 1 });
    const res = await updateDeckCard("deck-1", "dc-1", form({ quantity: "2" }));
    expect(res).toEqual({ ok: true });
    expect(mockPrisma.deckCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "dc-1", deckId: "deck-1" } })
    );
    expect(mockPrisma.deckCard.update).not.toHaveBeenCalled();
  });

  it("errors when the deckCard belongs to another deck", async () => {
    mockPrisma.deckCard.updateMany.mockResolvedValue({ count: 0 });
    const res = await updateDeckCard("deck-1", "dc-x", form({ quantity: "2" }));
    expect(res).toEqual({ error: "Card not found in deck" });
  });

  it("rejects a replacement cardId that does not exist in the catalog", async () => {
    mockPrisma.card.findUnique.mockResolvedValue(null);
    const res = await updateDeckCard(
      "deck-1",
      "dc-1",
      form({ quantity: "2", cardId: "ghost-card" })
    );
    expect(res).toEqual({ error: "Card not found" });
    expect(mockPrisma.deckCard.updateMany).not.toHaveBeenCalled();
  });
});
