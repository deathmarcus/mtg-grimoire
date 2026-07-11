import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser } = vi.hoisted(() => ({
  mockPrisma: {
    wishlistItem: {
      upsert: vi.fn(),
    },
  },
  mockRequireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { applyDeckImport } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
});

describe("applyDeckImport — payload validation", () => {
  it("rejects a payload with an out-of-range needed quantity without touching the DB", async () => {
    const payload = JSON.stringify({
      tag: "my-tag",
      rows: [{ scryfallId: "card-1", needed: 999999999 }],
    });
    const res = await applyDeckImport(payload);
    expect(res).toEqual({ ok: false, error: "Invalid payload" });
    expect(mockPrisma.wishlistItem.upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without touching the DB", async () => {
    const res = await applyDeckImport("not json");
    expect(res).toEqual({ ok: false, error: "Invalid payload" });
    expect(mockPrisma.wishlistItem.upsert).not.toHaveBeenCalled();
  });

  it("accepts a valid payload and upserts", async () => {
    mockPrisma.wishlistItem.upsert.mockResolvedValue({ id: "wi-1" });
    const payload = JSON.stringify({
      tag: "my-tag",
      rows: [{ scryfallId: "card-1", needed: 3 }],
    });
    const res = await applyDeckImport(payload);
    expect(res).toEqual({ ok: true, added: 1, skipped: 0 });
    expect(mockPrisma.wishlistItem.upsert).toHaveBeenCalled();
  });
});
