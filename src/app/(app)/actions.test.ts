import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireUser } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
  mockRequireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/session", () => ({ requireUser: mockRequireUser }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { setListPrefs } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue({ id: "user-1" });
  mockPrisma.user.findUnique.mockResolvedValue({ listPrefs: null });
});

describe("setListPrefs", () => {
  it("rejects an unknown scope without writing", async () => {
    const res = await setListPrefs("wishlist", { view: "text", group: "none", sort: "name" });
    expect(res).toEqual({ ok: false, error: "Invalid list prefs" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a view value outside the whitelist", async () => {
    const res = await setListPrefs("collection", { view: "kanban", group: "none", sort: "name" });
    expect(res).toEqual({ ok: false, error: "Invalid list prefs" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a group value outside the whitelist", async () => {
    const res = await setListPrefs("collection", { view: "text", group: "custom", sort: "name" });
    expect(res).toEqual({ ok: false, error: "Invalid list prefs" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a sort value outside the whitelist", async () => {
    const res = await setListPrefs("collection", { view: "text", group: "none", sort: "power" });
    expect(res).toEqual({ ok: false, error: "Invalid list prefs" });
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("accepts a valid scope+prefs and merges into existing listPrefs", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      listPrefs: { deck: { view: "stacks", group: "type", sort: "cmc" } },
    });
    const res = await setListPrefs("collection", { view: "grid", group: "color", sort: "price" });
    expect(res).toEqual({ ok: true });
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        listPrefs: {
          deck: { view: "stacks", group: "type", sort: "cmc" },
          collection: { view: "grid", group: "color", sort: "price" },
        },
      },
    });
  });
});
