import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser } = vi.hoisted(() => ({
  mockPrisma: {
    collection: { findFirst: vi.fn(), create: vi.fn() },
    card: { findMany: vi.fn() },
    importLog: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRequireUser: vi.fn(),
}));
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
