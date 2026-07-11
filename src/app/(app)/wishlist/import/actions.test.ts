import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser, mockResolveCardsBySetCollector, mockTx } = vi.hoisted(() => {
  const mockTx = { wishlistItem: { upsert: vi.fn() } };
  return {
    mockPrisma: {
      card: { findMany: vi.fn() },
      collectionItem: { groupBy: vi.fn() },
      wishlistItem: { upsert: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    },
    mockRequireUser: vi.fn(),
    mockResolveCardsBySetCollector: vi.fn(),
    mockTx,
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/card-resolver", async () => {
  const actual = await vi.importActual<typeof import("@/lib/card-resolver")>("@/lib/card-resolver");
  return { ...actual, resolveCardsBySetCollector: mockResolveCardsBySetCollector };
});

import { applyDeckImport, previewDeckImport } from "./actions";
import { setCollectorKey } from "@/lib/card-resolver";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
});

describe("previewDeckImport — batch card resolution and exact insensitive name match", () => {
  it("matches deck rows via resolveCardsBySetCollector and reports owned/needed from a single groupBy query", async () => {
    mockResolveCardsBySetCollector.mockResolvedValue(
      new Map([[setCollectorKey("OTJ", "142"), "card-1"]]),
    );
    mockPrisma.card.findMany.mockResolvedValue([
      { id: "card-1", name: "Lightning Bolt", setCode: "otj", collectorNumber: "142", imageSmall: "img.png" },
    ]);
    mockPrisma.collectionItem.groupBy.mockResolvedValue([
      { cardId: "card-1", _sum: { quantity: 2 } },
    ]);

    const res = await previewDeckImport("1 Lightning Bolt (OTJ) 142");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).toMatchObject({
      scryfallId: "card-1",
      owned: 2,
      needed: 0,
      matched: true,
    });
    expect(res.counts).toEqual({ total: 1, matched: 1, missing: 0, alreadyOwned: 1, toAdd: 0 });
    // Ownership must come from a single batched groupBy, not one query per row.
    expect(mockPrisma.collectionItem.groupBy).toHaveBeenCalledTimes(1);
  });

  it("marks a row unmatched when the resolver could not find the card", async () => {
    mockResolveCardsBySetCollector.mockResolvedValue(new Map());
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockPrisma.collectionItem.groupBy.mockResolvedValue([]);

    const res = await previewDeckImport("1 Unknown Card (XYZ) 1");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.rows[0].matched).toBe(false);
    expect(res.counts.missing).toBe(1);
  });
});

describe("applyDeckImport — payload validation", () => {
  it("rejects a payload with an out-of-range needed quantity without touching the DB", async () => {
    const payload = JSON.stringify({
      tag: "my-tag",
      rows: [{ scryfallId: "card-1", needed: 999999999 }],
    });
    const res = await applyDeckImport(payload);
    expect(res).toEqual({ ok: false, error: "Invalid payload" });
    expect(mockTx.wishlistItem.upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without touching the DB", async () => {
    const res = await applyDeckImport("not json");
    expect(res).toEqual({ ok: false, error: "Invalid payload" });
    expect(mockTx.wishlistItem.upsert).not.toHaveBeenCalled();
  });

  it("accepts a valid payload and upserts inside a transaction", async () => {
    mockTx.wishlistItem.upsert.mockResolvedValue({ id: "wi-1" });
    const payload = JSON.stringify({
      tag: "my-tag",
      rows: [{ scryfallId: "card-1", needed: 3 }],
    });
    const res = await applyDeckImport(payload);
    expect(res).toEqual({ ok: true, added: 1, skipped: 0 });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 30000 }),
    );
    expect(mockTx.wishlistItem.upsert).toHaveBeenCalled();
  });
});
