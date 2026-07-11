import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockPrisma } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockPrisma: {
    collectionItem: { findMany: vi.fn() },
    wishlistItem: { findMany: vi.fn() },
    deck: { findFirst: vi.fn() },
  },
}));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

function req(qs: string) {
  return new Request(`http://localhost/api/export?${qs}`);
}

const cardRef = {
  id: "abc-123",
  name: "Llanowar Elves",
  setCode: "m19",
  collectorNumber: "314",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  mockPrisma.collectionItem.findMany.mockResolvedValue([
    {
      quantity: 2,
      foil: "NORMAL",
      language: "en",
      condition: "NM",
      acquiredPrice: null,
      notes: "hidden note",
      card: cardRef,
    },
  ]);
});

describe("GET /api/export", () => {
  it("returns 401 without a session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(req("type=collection&format=csv"));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid type or format", async () => {
    expect((await GET(req("type=bogus&format=csv"))).status).toBe(400);
    expect((await GET(req("type=collection&format=xml"))).status).toBe(400);
  });

  it("exports collection CSV scoped to the session user", async () => {
    const res = await GET(req("type=collection&format=csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("collection");
    expect(res.headers.get("x-export-schema-version")).toBe("1");
    const body = await res.text();
    expect(body).toContain("Llanowar Elves");
    expect(body).not.toContain("hidden note");
    expect(mockPrisma.collectionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
  });

  it("includes notes only when notes=1", async () => {
    const res = await GET(req("type=collection&format=csv&notes=1"));
    expect(await res.text()).toContain("hidden note");
  });

  it("exports collection JSON with schema version", async () => {
    const res = await GET(req("type=collection&format=json"));
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();
    expect(json.schemaVersion).toBe(1);
    expect(json.type).toBe("collection");
    expect(json.data[0].card.name).toBe("Llanowar Elves");
  });

  it("exports a deck only if owned by the user, 404 otherwise", async () => {
    mockPrisma.deck.findFirst.mockResolvedValue(null);
    const res = await GET(req("type=deck&format=csv&deckId=d1"));
    expect(res.status).toBe(404);
    expect(mockPrisma.deck.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "d1", userId: "user-1" }),
      })
    );
  });

  it("returns 400 for type=deck without deckId", async () => {
    expect((await GET(req("type=deck&format=csv"))).status).toBe(400);
  });

  it("exports wishlist CSV", async () => {
    mockPrisma.wishlistItem.findMany.mockResolvedValue([
      {
        quantityWanted: 1,
        maxPriceUsd: 5,
        priority: "HIGH",
        tag: null,
        notes: null,
        card: cardRef,
      },
    ]);
    const res = await GET(req("type=wishlist&format=csv"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Quantity wanted");
  });
});
