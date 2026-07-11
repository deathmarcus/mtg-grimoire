import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma, mockRedirect } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    deck: { findUnique: vi.fn(), create: vi.fn() },
  },
  mockRedirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));

import { copyDeck } from "./actions";
import { __resetRateLimitStore } from "@/lib/rate-limit";

const publicSource = {
  name: "Mono Red Burn",
  format: "Modern",
  description: "Fast deck.",
  isPublic: true,
  cards: [
    { cardId: "c1", quantity: 4, isCommander: false, board: "MAIN", category: null },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitStore();
  mockAuth.mockResolvedValue({ user: { id: "user-2" } });
  mockPrisma.deck.findUnique.mockResolvedValue(publicSource);
  mockPrisma.deck.create.mockResolvedValue({ id: "new-deck-1" });
});

describe("copyDeck", () => {
  it("rejects a malformed slug without querying the DB", async () => {
    const res = await copyDeck("../etc/passwd");
    expect(res).toEqual({ error: "Deck not found" });
    expect(mockPrisma.deck.findUnique).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await copyDeck("mono-red-burn-x7k2m");
    expect(res).toEqual({ error: "Sign in required" });
    expect(mockPrisma.deck.findUnique).not.toHaveBeenCalled();
  });

  it("rejects when the source deck is private", async () => {
    mockPrisma.deck.findUnique.mockResolvedValue({ ...publicSource, isPublic: false });
    const res = await copyDeck("mono-red-burn-x7k2m");
    expect(res).toEqual({ error: "Deck not found" });
    expect(mockPrisma.deck.create).not.toHaveBeenCalled();
  });

  it("rejects when the slug does not exist", async () => {
    mockPrisma.deck.findUnique.mockResolvedValue(null);
    const res = await copyDeck("ghost-deck-x1y2z");
    expect(res).toEqual({ error: "Deck not found" });
  });

  it("clones the deck to the session user and redirects to it", async () => {
    await expect(copyDeck("mono-red-burn-x7k2m")).rejects.toThrow("NEXT_REDIRECT");

    expect(mockPrisma.deck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-2",
          name: "Copia de Mono Red Burn",
          format: "Modern",
          description: "Fast deck.",
          cards: {
            create: [
              { cardId: "c1", quantity: 4, isCommander: false, board: "MAIN", category: null },
            ],
          },
        }),
      })
    );
    expect(mockRedirect).toHaveBeenCalledWith("/decks/new-deck-1");
  });

  it("rate-limits to 10 copies per hour per user", async () => {
    for (let i = 0; i < 10; i++) {
      await expect(copyDeck("mono-red-burn-x7k2m")).rejects.toThrow("NEXT_REDIRECT");
    }
    const res = await copyDeck("mono-red-burn-x7k2m");
    expect(res).toEqual({ error: "Too many copies — try again later" });
  });
});
