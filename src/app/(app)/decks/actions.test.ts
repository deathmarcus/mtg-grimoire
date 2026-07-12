import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser } = vi.hoisted(() => ({
  mockPrisma: {
    deck: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    deckCard: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    card: { findUnique: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
  mockRequireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { removeCardFromDeck, updateDeckCard, setDeckPublic, searchCardsForDeck } from "./actions";

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

describe("setDeckPublic — ownership + slug generation", () => {
  it("errors without touching the DB when the deck belongs to another user", async () => {
    mockPrisma.deck.findFirst.mockResolvedValue(null);
    const res = await setDeckPublic("deck-1", true);
    expect(res).toEqual({ error: "Deck not found" });
    expect(mockPrisma.deck.update).not.toHaveBeenCalled();
  });

  it("generates and persists a slug the first time a deck is made public", async () => {
    mockPrisma.deck.findFirst.mockResolvedValue({
      id: "deck-1",
      name: "Mono Red Burn",
      slug: null,
      publicSince: null,
    });
    mockPrisma.deck.findUnique.mockResolvedValue(null); // slug candidate is free
    mockPrisma.deck.update.mockResolvedValue({});

    const res = await setDeckPublic("deck-1", true);

    expect("ok" in res && res.ok).toBe(true);
    expect(mockPrisma.deck.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "deck-1" },
        data: expect.objectContaining({
          isPublic: true,
          slug: expect.stringMatching(/^mono-red-burn-[a-z0-9]{5}$/),
          publicSince: expect.any(Date),
        }),
      })
    );
  });

  it("reuses the existing slug and does not reset publicSince on re-activation", async () => {
    const existingDate = new Date("2026-01-01T00:00:00Z");
    mockPrisma.deck.findFirst.mockResolvedValue({
      id: "deck-1",
      name: "Mono Red Burn",
      slug: "mono-red-burn-abcde",
      publicSince: existingDate,
    });
    mockPrisma.deck.update.mockResolvedValue({});

    const res = await setDeckPublic("deck-1", true);

    expect(res).toEqual({ ok: true, slug: "mono-red-burn-abcde" });
    expect(mockPrisma.deck.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.deck.update).toHaveBeenCalledWith({
      where: { id: "deck-1" },
      data: {
        isPublic: true,
        slug: "mono-red-burn-abcde",
        publicSince: existingDate,
      },
    });
  });

  it("deactivating keeps the slug and does not touch publicSince", async () => {
    mockPrisma.deck.findFirst.mockResolvedValue({
      id: "deck-1",
      name: "Mono Red Burn",
      slug: "mono-red-burn-abcde",
      publicSince: new Date("2026-01-01T00:00:00Z"),
    });
    mockPrisma.deck.update.mockResolvedValue({});

    const res = await setDeckPublic("deck-1", false);

    expect(res).toEqual({ ok: true, slug: "mono-red-burn-abcde" });
    expect(mockPrisma.deck.update).toHaveBeenCalledWith({
      where: { id: "deck-1" },
      data: { isPublic: false },
    });
  });
});

describe("searchCardsForDeck ownedOnly", () => {
  it("con ownedOnly restringe a nombres presentes en la colección del usuario", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { name: "Lightning Bolt" },
      { name: "Sol Ring" },
    ]);
    mockPrisma.card.findMany.mockResolvedValue([]);
    await searchCardsForDeck("bolt", { ownedOnly: true });
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { in: ["Lightning Bolt"] } },
      }),
    );
  });

  it("con ownedOnly y ningún nombre matcheando → [] sin query al catálogo", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ name: "Sol Ring" }]);
    const r = await searchCardsForDeck("bolt", { ownedOnly: true });
    expect(r).toEqual([]);
    expect(mockPrisma.card.findMany).not.toHaveBeenCalled();
  });

  it("sin ownedOnly conserva el comportamiento actual (contains insensitive)", async () => {
    mockPrisma.card.findMany.mockResolvedValue([]);
    await searchCardsForDeck("bolt");
    expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { contains: "bolt", mode: "insensitive" } },
      }),
    );
  });
});
