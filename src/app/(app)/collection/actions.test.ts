import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser } = vi.hoisted(() => ({
  mockPrisma: {
    collection: { findFirst: vi.fn(), create: vi.fn() },
    card: { findUnique: vi.fn() },
    collectionItem: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockRequireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addCollectionItem, updateCollectionItem } from "./actions";

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
