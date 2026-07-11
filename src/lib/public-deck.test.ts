import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    deck: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getPublicDeckBySlug, groupPublicCardsByType } from "./public-deck";

function card(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c1",
    name: "Lightning Bolt",
    typeLine: "Instant",
    manaCost: "{R}",
    cmc: 1,
    imageNormal: "https://cards.scryfall.io/normal/bolt.jpg",
    setCode: "lea",
    colorIdentity: ["R"],
    ...overrides,
  };
}

function deckCard(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "dc1",
    quantity: 1,
    isCommander: false,
    board: "MAIN",
    card: card(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublicDeckBySlug", () => {
  it("returns null for a malformed slug without querying the DB", async () => {
    const result = await getPublicDeckBySlug("../etc/passwd");
    expect(result).toBeNull();
    expect(mockPrisma.deck.findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the deck does not exist", async () => {
    mockPrisma.deck.findUnique.mockResolvedValue(null);
    const result = await getPublicDeckBySlug("ghost-deck-x1y2z");
    expect(result).toBeNull();
  });

  it("returns null when the deck exists but is private", async () => {
    mockPrisma.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      name: "Secret Deck",
      format: "Modern",
      description: null,
      isPublic: false,
      publicSince: null,
      user: { name: "Marco" },
      cards: [],
    });
    const result = await getPublicDeckBySlug("secret-deck-abcde");
    expect(result).toBeNull();
  });

  it("shapes a public deck: separates commander, main and side, computes totals", async () => {
    mockPrisma.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      name: "Mono Red Burn",
      format: "Modern",
      description: "Fast and mean.",
      isPublic: true,
      publicSince: new Date("2026-01-01T00:00:00Z"),
      user: { name: "Marco" },
      cards: [
        deckCard({ id: "cmd", isCommander: true, quantity: 1, card: card({ id: "c-cmd", name: "Krenko" }) }),
        deckCard({ id: "m1", quantity: 4, card: card({ id: "c1", name: "Lightning Bolt" }) }),
        deckCard({ id: "s1", board: "SIDE", quantity: 2, card: card({ id: "c2", name: "Smash to Smithereens" }) }),
      ],
    });

    const result = await getPublicDeckBySlug("mono-red-burn-x7k2m");

    expect(result).not.toBeNull();
    expect(result?.ownerName).toBe("Marco");
    expect(result?.commander?.card.name).toBe("Krenko");
    expect(result?.mainCards).toHaveLength(1);
    expect(result?.sideCards).toHaveLength(1);
    expect(result?.totalCards).toBe(5); // 1 commander + 4 mainboard
    expect(result?.coverImage).toBe(card().imageNormal);
  });

  it("never exposes owner email — only name", async () => {
    mockPrisma.deck.findUnique.mockResolvedValue({
      id: "deck-1",
      name: "Deck",
      format: "",
      description: null,
      isPublic: true,
      publicSince: null,
      user: { name: null },
      cards: [],
    });
    const result = await getPublicDeckBySlug("deck-abcde");
    expect(result?.ownerName).toBeNull();
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("ownerEmail");
  });
});

describe("groupPublicCardsByType", () => {
  it("groups cards by type in TYPE_ORDER and omits empty groups", () => {
    const cards = [
      deckCard({ card: card({ typeLine: "Land" }) }),
      deckCard({ card: card({ typeLine: "Creature — Goblin" }) }),
      deckCard({ card: card({ typeLine: "Instant" }) }),
    ];
    const groups = groupPublicCardsByType(cards);
    expect(groups.map((g) => g.type)).toEqual(["Creature", "Instant", "Land"]);
  });
});
