import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    collection: { findFirst: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("./prisma", () => ({ prisma: mockPrisma }));

import { requireOwnedCollectionId } from "./collections";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireOwnedCollectionId", () => {
  it("returns the id when the collection belongs to the user", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue({ id: "col-1" });
    const out = await requireOwnedCollectionId("user-1", "col-1");
    expect(out).toBe("col-1");
    expect(mockPrisma.collection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "col-1", userId: "user-1" }),
      })
    );
  });

  it("returns null when the collection belongs to another user", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);
    const out = await requireOwnedCollectionId("user-1", "col-of-other");
    expect(out).toBeNull();
  });

  it("falls back to the default collection when no id is given", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue({ id: "default-col" });
    expect(await requireOwnedCollectionId("user-1", null)).toBe("default-col");
    expect(await requireOwnedCollectionId("user-1", "")).toBe("default-col");
    expect(await requireOwnedCollectionId("user-1", undefined)).toBe(
      "default-col"
    );
  });
});
