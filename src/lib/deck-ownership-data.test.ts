// src/lib/deck-ownership-data.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getOwnedQuantitiesByName, getCheapestByName } from "./deck-ownership-data";

beforeEach(() => vi.clearAllMocks());

describe("getOwnedQuantitiesByName", () => {
  it("construye el record nombre→qty desde las filas", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { name: "lightning bolt", qty: 4 },
      { name: "sol ring", qty: 1 },
    ]);
    const r = await getOwnedQuantitiesByName("user-1");
    expect(r).toEqual({ "lightning bolt": 4, "sol ring": 1 });
  });

  it("colección vacía → record vacío", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    expect(await getOwnedQuantitiesByName("user-1")).toEqual({});
  });

  it("pasa los nombres lowercased como parámetro cuando se filtran", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    await getOwnedQuantitiesByName("user-1", ["Lightning BOLT"]);
    const sql = mockPrisma.$queryRaw.mock.calls[0][0];
    expect(sql.values).toContain("user-1");
    expect(sql.values.flat()).toContain("lightning bolt");
  });
});

describe("getCheapestByName", () => {
  it("nombres vacíos → sin query", async () => {
    expect(await getCheapestByName([])).toEqual({});
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("convierte Decimal-like a number", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ name: "force of will", cheapest: "55.30" }]);
    expect(await getCheapestByName(["Force of Will"])).toEqual({ "force of will": 55.3 });
  });
});
