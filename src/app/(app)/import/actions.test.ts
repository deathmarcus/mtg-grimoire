import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser, mockTx } = vi.hoisted(() => {
  const mockTx = {
    collectionItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return {
    mockPrisma: {
      collection: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
      card: { findMany: vi.fn() },
      collectionItem: { findMany: vi.fn() },
      importLog: { findMany: vi.fn(), create: vi.fn() },
      $transaction: vi.fn(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx)),
    },
    mockRequireUser: vi.fn(),
    mockTx,
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { applyImport, getRecentImports } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
});

describe("applyImport — collectionId ownership", () => {
  it("rejects a collectionId owned by another user without writing", async () => {
    mockPrisma.card.findMany.mockResolvedValue([]);
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await applyImport(
      JSON.stringify({
        mode: "add",
        collectionId: "col-of-other",
        format: "manabox",
        filename: "x.csv",
        rows: [],
      })
    );
    expect(res).toEqual({ ok: false, error: "Invalid collection" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("applyImport — batch apply (no per-row findUnique)", () => {
  it("computes merged/inserted from a single existing-items query and never calls findUnique per row", async () => {
    mockPrisma.card.findMany.mockResolvedValue([{ id: "card-1" }, { id: "card-2" }]);
    mockPrisma.collection.findFirst.mockResolvedValue({ id: "col-1" });
    mockPrisma.collectionItem.findMany.mockResolvedValue([
      { cardId: "card-1", foil: "NORMAL", language: "en", condition: "NM" },
    ]);
    mockTx.collectionItem.createMany.mockResolvedValue({ count: 1 });
    mockTx.collectionItem.update.mockResolvedValue({});
    mockPrisma.importLog.create.mockResolvedValue({});
    mockPrisma.collection.findUnique.mockResolvedValue({ name: "Mi colección" });

    const res = await applyImport(
      JSON.stringify({
        mode: "add",
        collectionId: "col-1",
        format: "manabox",
        filename: "x.csv",
        rows: [
          {
            scryfallId: "card-1", // already owned -> merge
            quantity: 2,
            foil: "NORMAL",
            condition: "NM",
            language: "en",
            acquiredPrice: null,
            acquiredCurrency: null,
          },
          {
            scryfallId: "card-2", // new -> insert
            quantity: 3,
            foil: "NORMAL",
            condition: "NM",
            language: "en",
            acquiredPrice: null,
            acquiredCurrency: null,
          },
        ],
      })
    );

    expect(res).toEqual({ ok: true, inserted: 1, merged: 1, replaced: false });
    expect(mockTx.collectionItem.findUnique).not.toHaveBeenCalled();
    expect(mockTx.collectionItem.createMany).toHaveBeenCalledTimes(1);
    expect(mockTx.collectionItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ cardId: "card-2", quantity: 3 })],
        skipDuplicates: true,
      })
    );
    expect(mockTx.collectionItem.update).toHaveBeenCalledTimes(1);
    expect(mockTx.collectionItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: { increment: 2 } },
      })
    );
    // Use only the single findMany call to compute existing keys, not one per row.
    expect(mockPrisma.collectionItem.findMany).toHaveBeenCalledTimes(1);
  });

  it("sums quantities for duplicate rows within the same payload before batching", async () => {
    mockPrisma.card.findMany.mockResolvedValue([{ id: "card-1" }]);
    mockPrisma.collection.findFirst.mockResolvedValue({ id: "col-1" });
    mockPrisma.collectionItem.findMany.mockResolvedValue([]);
    mockTx.collectionItem.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.importLog.create.mockResolvedValue({});
    mockPrisma.collection.findUnique.mockResolvedValue({ name: "Mi colección" });

    const dupRow = {
      scryfallId: "card-1",
      quantity: 2,
      foil: "NORMAL",
      condition: "NM",
      language: "en",
      acquiredPrice: null,
      acquiredCurrency: null,
    };

    const res = await applyImport(
      JSON.stringify({
        mode: "add",
        collectionId: "col-1",
        format: "manabox",
        filename: "x.csv",
        rows: [dupRow, dupRow],
      })
    );

    expect(res).toEqual({ ok: true, inserted: 1, merged: 0, replaced: false });
    expect(mockTx.collectionItem.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ cardId: "card-1", quantity: 4 })],
      })
    );
  });
});

describe("getRecentImports — session-derived user", () => {
  it("derives the userId from the session instead of an argument", async () => {
    mockPrisma.importLog.findMany.mockResolvedValue([]);
    await getRecentImports(5);
    expect(mockRequireUser).toHaveBeenCalled();
    expect(mockPrisma.importLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        take: 5,
      })
    );
  });
});
