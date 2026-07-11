import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser } = vi.hoisted(() => ({
  mockPrisma: {
    collection: { findFirst: vi.fn(), create: vi.fn() },
    card: { findUnique: vi.fn() },
    collectionItem: {
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockRequireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
const { mockLogActivity } = vi.hoisted(() => ({ mockLogActivity: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: mockLogActivity }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addCollectionItem,
  updateCollectionItem,
  updateItemQuantity,
  bulkUpdateItems,
  bulkDeleteItems,
} from "./actions";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
});

describe("addCollectionItem — collectionId ownership", () => {
  it("rejects a collectionId owned by another user without writing", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await addCollectionItem(
      form({ cardId: "card-1", quantity: "1", collectionId: "col-of-other" })
    );
    expect(res).toEqual({ error: "Invalid collection" });
    expect(mockPrisma.collectionItem.upsert).not.toHaveBeenCalled();
  });

  it("accepts an owned collectionId", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue({ id: "col-1" });
    mockPrisma.collectionItem.upsert.mockResolvedValue({ id: "item-1" });
    mockPrisma.card.findUnique.mockResolvedValue({ name: "Llanowar Elves" });
    const res = await addCollectionItem(
      form({ cardId: "card-1", quantity: "1", collectionId: "col-1" })
    );
    expect(res).not.toHaveProperty("error");
    expect(mockPrisma.collectionItem.upsert).toHaveBeenCalled();
  });
});

describe("updateCollectionItem — collectionId ownership", () => {
  it("rejects moving an item into a foreign collection", async () => {
    mockPrisma.collectionItem.findUnique.mockResolvedValueOnce({
      id: "item-1",
      userId: "user-1",
      cardId: "card-1",
    });
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await updateCollectionItem(
      "item-1",
      form({
        quantity: "2",
        foil: "NORMAL",
        language: "en",
        condition: "NM",
        collectionId: "col-of-other",
      })
    );
    expect(res).toEqual({ ok: false, error: "Invalid collection" });
    expect(mockPrisma.collectionItem.update).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("updateItemQuantity — validation", () => {
  it.each([0, -1, 2.5, 10000])(
    "rejects invalid quantity %p without touching the DB",
    async (quantity) => {
      const res = await updateItemQuantity("item-1", quantity);
      expect(res).toEqual({ error: "Invalid quantity" });
      expect(mockPrisma.collectionItem.updateMany).not.toHaveBeenCalled();
    },
  );

  it("accepts a valid quantity and updates", async () => {
    mockPrisma.collectionItem.updateMany.mockResolvedValue({ count: 1 });
    const res = await updateItemQuantity("item-1", 3);
    expect(res).not.toEqual({ error: "Invalid quantity" });
    expect(mockPrisma.collectionItem.updateMany).toHaveBeenCalledWith({
      where: { id: "item-1", userId: "user-1" },
      data: { quantity: 3 },
    });
  });
});

describe("bulkUpdateItems — validation, ownership and transactionality", () => {
  it("rejects an empty selection without touching the DB", async () => {
    const res = await bulkUpdateItems([], { condition: "LP" });
    expect(res).toEqual({ ok: false, error: "Invalid selection" });
    expect(mockPrisma.collectionItem.findMany).not.toHaveBeenCalled();
  });

  it("rejects a selection over the 1000 cap", async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `item-${i}`);
    const res = await bulkUpdateItems(ids, { condition: "LP" });
    expect(res).toEqual({ ok: false, error: "Invalid selection" });
  });

  it("rejects an invalid enum value", async () => {
    const res = await bulkUpdateItems(["item-1"], { foil: "SHINY" as never });
    expect(res).toEqual({ ok: false, error: "No changes to apply" });
    expect(mockPrisma.collectionItem.findMany).not.toHaveBeenCalled();
  });

  it("rejects a change object with no fields set", async () => {
    const res = await bulkUpdateItems(["item-1"], {});
    expect(res).toEqual({ ok: false, error: "No changes to apply" });
  });

  it("rejects moving into a folder the user doesn't own", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const res = await bulkUpdateItems(["item-1"], { collectionId: "col-of-other" });
    expect(res).toEqual({ ok: false, error: "Invalid collection" });
    expect(mockPrisma.collectionItem.findMany).not.toHaveBeenCalled();
  });

  it("only touches rows scoped to the current user — ids owned by others simply don't match", async () => {
    // Selection includes an id belonging to another user; findMany (scoped by userId)
    // only returns the row(s) that actually belong to user-1.
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([
      {
        id: "item-1",
        cardId: "card-1",
        collectionId: "col-1",
        foil: "NORMAL",
        language: "en",
        condition: "NM",
        quantity: 2,
      },
    ]);
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([]); // existing candidates
    mockPrisma.$transaction.mockResolvedValue([{}]);

    const res = await bulkUpdateItems(["item-1", "item-of-other-user"], { condition: "LP" });

    expect(res).toEqual({ ok: true, updated: 1, merged: 0 });
    expect(mockPrisma.collectionItem.findMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ["item-1", "item-of-other-user"] }, userId: "user-1" },
      select: expect.any(Object),
    });
  });

  it("runs the plan through a single $transaction call", async () => {
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([
      {
        id: "item-1",
        cardId: "card-1",
        collectionId: "col-1",
        foil: "NORMAL",
        language: "en",
        condition: "NM",
        quantity: 2,
      },
      {
        id: "item-2",
        cardId: "card-1",
        collectionId: "col-1",
        foil: "FOIL",
        language: "en",
        condition: "NM",
        quantity: 3,
      },
    ]);
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([]); // no pre-existing collision
    mockPrisma.$transaction.mockResolvedValue([{}]);

    // Both items are card-1 in col-1; setting foil=FOIL on both collapses them.
    const res = await bulkUpdateItems(["item-1", "item-2"], { foil: "FOIL" });

    expect(res).toEqual({ ok: true, updated: 2, merged: 1 });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    const ops = mockPrisma.$transaction.mock.calls[0][0] as unknown[];
    expect(ops.length).toBeGreaterThan(0);
    // Survivor update (item-1, quantity 5) + a deleteMany for item-2.
    expect(mockPrisma.collectionItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: {
        collectionId: "col-1",
        foil: "FOIL",
        language: "en",
        condition: "NM",
        quantity: 5,
      },
    });
    expect(mockPrisma.collectionItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-2"] }, userId: "user-1" },
    });
  });

  it("merges into a pre-existing unselected row via incrementExisting", async () => {
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([
      {
        id: "item-1",
        cardId: "card-1",
        collectionId: "col-1",
        foil: "NORMAL",
        language: "en",
        condition: "NM",
        quantity: 4,
      },
    ]);
    mockPrisma.collection.findFirst.mockResolvedValue({ id: "col-2" });
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([
      {
        id: "existing-1",
        cardId: "card-1",
        collectionId: "col-2",
        foil: "NORMAL",
        language: "en",
        condition: "NM",
      },
    ]);
    mockPrisma.$transaction.mockResolvedValue([{}]);

    const res = await bulkUpdateItems(["item-1"], { collectionId: "col-2" });

    expect(res).toEqual({ ok: true, updated: 1, merged: 1 });
    expect(mockPrisma.collectionItem.update).toHaveBeenCalledWith({
      where: { id: "existing-1" },
      data: { quantity: { increment: 4 } },
    });
    expect(mockPrisma.collectionItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1"] }, userId: "user-1" },
    });
  });

  it("logs a bulk_update activity entry", async () => {
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([
      {
        id: "item-1",
        cardId: "card-1",
        collectionId: "col-1",
        foil: "NORMAL",
        language: "en",
        condition: "NM",
        quantity: 1,
      },
    ]);
    mockPrisma.collectionItem.findMany.mockResolvedValueOnce([]);
    mockPrisma.$transaction.mockResolvedValue([{}]);

    await bulkUpdateItems(["item-1"], { condition: "LP" });

    expect(mockLogActivity).toHaveBeenCalledWith("user-1", "bulk_update", {
      count: 1,
      merged: 0,
    });
  });
});

describe("bulkDeleteItems — validation, ownership and transactionality", () => {
  it("rejects an empty selection without touching the DB", async () => {
    const res = await bulkDeleteItems([]);
    expect(res).toEqual({ ok: false, error: "Invalid selection" });
    expect(mockPrisma.collectionItem.findMany).not.toHaveBeenCalled();
  });

  it("only deletes rows scoped to the current user", async () => {
    mockPrisma.collectionItem.findMany.mockResolvedValue([
      { id: "item-1", quantity: 2 },
      { id: "item-2", quantity: 1 },
    ]);
    mockPrisma.$transaction.mockResolvedValue([{ count: 2 }]);

    const res = await bulkDeleteItems(["item-1", "item-2", "item-of-other-user"]);

    expect(res).toEqual({ ok: true, deleted: 2 });
    expect(mockPrisma.collectionItem.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1", "item-2", "item-of-other-user"] }, userId: "user-1" },
      select: { id: true, quantity: true },
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.collectionItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["item-1", "item-2"] }, userId: "user-1" },
    });
  });

  it("returns an error when none of the selected ids belong to the user", async () => {
    mockPrisma.collectionItem.findMany.mockResolvedValue([]);
    const res = await bulkDeleteItems(["item-of-other-user"]);
    expect(res).toEqual({ ok: false, error: "Not found" });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("logs a bulk_delete activity entry with aggregate quantity", async () => {
    mockPrisma.collectionItem.findMany.mockResolvedValue([
      { id: "item-1", quantity: 2 },
      { id: "item-2", quantity: 5 },
    ]);
    mockPrisma.$transaction.mockResolvedValue([{ count: 2 }]);

    await bulkDeleteItems(["item-1", "item-2"]);

    expect(mockLogActivity).toHaveBeenCalledWith("user-1", "bulk_delete", {
      count: 2,
      totalQuantity: 7,
    });
  });
});
