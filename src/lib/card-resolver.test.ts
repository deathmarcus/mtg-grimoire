import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockFetchJson } = vi.hoisted(() => ({
  mockPrisma: {
    card: { findMany: vi.fn(), upsert: vi.fn() },
  },
  mockFetchJson: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/scryfall", async () => {
  const actual = await vi.importActual<typeof import("@/lib/scryfall")>("@/lib/scryfall");
  return { ...actual, fetchJson: mockFetchJson };
});

import {
  setCollectorKey,
  ensureCardsExist,
  resolveCardsBySetCollector,
  upsertCardFromScryfall,
  MAX_LIVE_FETCHES,
} from "./card-resolver";

beforeEach(() => {
  vi.clearAllMocks();
});

function scryfallCard(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    oracle_id: "oracle-1",
    name: "Lightning Bolt",
    set: "otj",
    set_name: "Outlaws of Thunder Junction",
    collector_number: "142",
    rarity: "common",
    lang: "en",
    prices: { usd: null, usd_foil: null, usd_etched: null, eur: null, eur_foil: null, tix: null },
    ...overrides,
  };
}

describe("setCollectorKey", () => {
  it("lowercases the set code", () => {
    expect(setCollectorKey("OTJ", "142")).toBe("otj|142");
    expect(setCollectorKey("otj", "142")).toBe("otj|142");
  });
});

describe("upsertCardFromScryfall", () => {
  it("fetches, upserts, and returns the card id", async () => {
    mockFetchJson.mockResolvedValue(scryfallCard());
    mockPrisma.card.upsert.mockResolvedValue({});
    const id = await upsertCardFromScryfall("https://api.scryfall.com/cards/named?exact=Lightning+Bolt");
    expect(id).toBe("11111111-1111-1111-1111-111111111111");
    expect(mockPrisma.card.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "11111111-1111-1111-1111-111111111111" },
      }),
    );
  });

  it("returns null when the fetch fails", async () => {
    mockFetchJson.mockRejectedValue(new Error("404"));
    const id = await upsertCardFromScryfall("https://api.scryfall.com/cards/does-not-exist");
    expect(id).toBeNull();
    expect(mockPrisma.card.upsert).not.toHaveBeenCalled();
  });
});

describe("ensureCardsExist", () => {
  it("filters out ids that are not valid Scryfall UUIDs before live-fetching", async () => {
    mockPrisma.card.findMany.mockResolvedValue([]);
    const result = await ensureCardsExist(["not-a-uuid", "also bad"]);
    expect(result.size).toBe(0);
    expect(mockFetchJson).not.toHaveBeenCalled();
  });

  it("returns known ids without any live fetch", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    mockPrisma.card.findMany.mockResolvedValue([{ id }]);
    const result = await ensureCardsExist([id]);
    expect(result.has(id)).toBe(true);
    expect(mockFetchJson).not.toHaveBeenCalled();
  });

  it("caps live fetches at MAX_LIVE_FETCHES", async () => {
    const ids = Array.from({ length: MAX_LIVE_FETCHES + 5 }, (_, i) =>
      `1111111${i.toString().padStart(1, "0")}-1111-1111-1111-11111111111${i % 10}`,
    ).map((_, i) => `abcdef${i.toString().padStart(2, "0")}-1234-1234-1234-1234567890ab`);
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockFetchJson.mockImplementation(async () => scryfallCard({ id: "11111111-1111-1111-1111-111111111111" }));
    mockPrisma.card.upsert.mockResolvedValue({});
    await ensureCardsExist(ids);
    expect(mockFetchJson).toHaveBeenCalledTimes(MAX_LIVE_FETCHES);
  }, 15000);
});

describe("resolveCardsBySetCollector", () => {
  it("resolves via set+collector lookup, normalizing the key casing", async () => {
    mockPrisma.card.findMany.mockResolvedValueOnce([
      { id: "card-1", setCode: "otj", collectorNumber: "142", name: "Lightning Bolt" },
    ]);
    const result = await resolveCardsBySetCollector([
      { name: "Lightning Bolt", setCode: "OTJ", collectorNumber: "142" },
    ]);
    expect(result.get(setCollectorKey("OTJ", "142"))).toBe("card-1");
    expect(result.get(setCollectorKey("otj", "142"))).toBe("card-1");
  });

  it("falls back to case-insensitive name+set match when collector number is wrong", async () => {
    mockPrisma.card.findMany
      .mockResolvedValueOnce([]) // set+collector: no match
      .mockResolvedValueOnce([
        { id: "card-2", setCode: "otj", collectorNumber: "999", name: "Lightning Bolt" },
      ]);
    const result = await resolveCardsBySetCollector([
      { name: "lightning bolt", setCode: "OTJ", collectorNumber: "142" },
    ]);
    expect(result.get(setCollectorKey("OTJ", "142"))).toBe("card-2");
  });

  it("falls back to a capped live Scryfall fetch for rows still unresolved", async () => {
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockFetchJson.mockResolvedValue(scryfallCard({ id: "card-3", set: "otj", collector_number: "142" }));
    mockPrisma.card.upsert.mockResolvedValue({});
    const result = await resolveCardsBySetCollector([
      { name: "Lightning Bolt", setCode: "OTJ", collectorNumber: "142" },
    ]);
    expect(result.get(setCollectorKey("OTJ", "142"))).toBe("card-3");
  });
});
