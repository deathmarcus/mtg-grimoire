import { describe, it, expect } from "vitest";
import { aggregateRows, planImport, type ApplyRow } from "./import-apply";
import { itemKey } from "./import-preview";

function row(overrides: Partial<ApplyRow> = {}): ApplyRow {
  return {
    scryfallId: "card-1",
    quantity: 1,
    foil: "NORMAL",
    language: "en",
    condition: "NM",
    acquiredPrice: null,
    acquiredCurrency: null,
    ...overrides,
  };
}

describe("aggregateRows", () => {
  it("sums quantities for duplicate cardId+foil+language+condition rows", () => {
    const rows = [row({ quantity: 2 }), row({ quantity: 3 })];
    const result = aggregateRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(5);
  });

  it("keeps distinct variants separate", () => {
    const rows = [row({ quantity: 2, foil: "NORMAL" }), row({ quantity: 3, foil: "FOIL" })];
    const result = aggregateRows(rows);
    expect(result).toHaveLength(2);
  });
});

describe("planImport", () => {
  it("splits rows into toCreate (new) vs toUpdate (merged) based on existingKeys, mode add", () => {
    const rows = [row({ scryfallId: "card-1", quantity: 2 }), row({ scryfallId: "card-2", quantity: 5 })];
    const existingKeys = new Set([itemKey("card-1", "NORMAL", "en", "NM")]);
    const plan = planImport(rows, existingKeys, "add");
    expect(plan.toCreate.map((r) => r.scryfallId)).toEqual(["card-2"]);
    expect(plan.toUpdate.map((r) => r.scryfallId)).toEqual(["card-1"]);
    expect(plan.inserted).toBe(1);
    expect(plan.merged).toBe(1);
  });

  it("treats every row as new in replace mode, ignoring existingKeys", () => {
    const rows = [row({ scryfallId: "card-1", quantity: 2 })];
    const existingKeys = new Set([itemKey("card-1", "NORMAL", "en", "NM")]);
    const plan = planImport(rows, existingKeys, "replace");
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.inserted).toBe(1);
    expect(plan.merged).toBe(0);
  });

  it("aggregates intra-payload duplicates before splitting, so quantities are not lost to skipDuplicates", () => {
    const rows = [
      row({ scryfallId: "card-1", quantity: 2 }),
      row({ scryfallId: "card-1", quantity: 3 }),
    ];
    const plan = planImport(rows, new Set(), "add");
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0].quantity).toBe(5);
  });
});
