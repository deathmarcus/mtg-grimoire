import { describe, it, expect } from "vitest";
import { planBulkEdit, type BulkItemSnapshot, type ExistingItem } from "./bulk-edit";

function item(overrides: Partial<BulkItemSnapshot> & { id: string }): BulkItemSnapshot {
  return {
    cardId: "card-1",
    collectionId: "col-1",
    foil: "NORMAL",
    language: "en",
    condition: "NM",
    quantity: 1,
    ...overrides,
  };
}

describe("planBulkEdit", () => {
  it("emits a plain field update when no collision occurs", () => {
    const plan = planBulkEdit(
      [item({ id: "a" }), item({ id: "b", cardId: "card-2" })],
      { condition: "LP" },
      [],
    );
    expect(plan.fieldUpdates).toEqual([
      { kind: "fieldUpdate", id: "a", collectionId: "col-1", foil: "NORMAL", language: "en", condition: "LP" },
      { kind: "fieldUpdate", id: "b", collectionId: "col-1", foil: "NORMAL", language: "en", condition: "LP" },
    ]);
    expect(plan.survivorUpdates).toEqual([]);
    expect(plan.existingIncrements).toEqual([]);
    expect(plan.deletedIds).toEqual([]);
  });

  it("collapses two selected items that land on the same key into a survivor", () => {
    // Both are card-1 in col-1, one NORMAL one FOIL, quantities 2 and 3.
    // Setting foil=FOIL on both makes them collide.
    const plan = planBulkEdit(
      [
        item({ id: "a", foil: "NORMAL", quantity: 2 }),
        item({ id: "b", foil: "FOIL", quantity: 3 }),
      ],
      { foil: "FOIL" },
      [],
    );
    expect(plan.survivorUpdates).toEqual([
      { kind: "survivorUpdate", id: "a", collectionId: "col-1", foil: "FOIL", language: "en", condition: "NM", quantity: 5 },
    ]);
    expect(plan.deletedIds).toEqual(["b"]);
    expect(plan.fieldUpdates).toEqual([]);
    expect(plan.existingIncrements).toEqual([]);
  });

  it("merges into a pre-existing unselected row when the new key matches it", () => {
    const existing: ExistingItem[] = [
      { id: "existing-1", cardId: "card-1", collectionId: "col-2", foil: "NORMAL", language: "en", condition: "NM" },
    ];
    const plan = planBulkEdit(
      [item({ id: "a", quantity: 4 })],
      { collectionId: "col-2" },
      existing,
    );
    expect(plan.existingIncrements).toEqual([
      { kind: "incrementExisting", id: "existing-1", incrementBy: 4 },
    ]);
    expect(plan.deletedIds).toEqual(["a"]);
    expect(plan.fieldUpdates).toEqual([]);
    expect(plan.survivorUpdates).toEqual([]);
  });

  it("routes a within-selection collapse through the existing row when both collide on the same key", () => {
    const existing: ExistingItem[] = [
      { id: "existing-1", cardId: "card-1", collectionId: "col-1", foil: "FOIL", language: "en", condition: "NM" },
    ];
    const plan = planBulkEdit(
      [
        item({ id: "a", foil: "NORMAL", quantity: 2 }),
        item({ id: "b", foil: "ETCHED", quantity: 3 }),
      ],
      { foil: "FOIL" },
      existing,
    );
    expect(plan.existingIncrements).toEqual([
      { kind: "incrementExisting", id: "existing-1", incrementBy: 5 },
    ]);
    expect(plan.deletedIds.sort()).toEqual(["a", "b"]);
    expect(plan.survivorUpdates).toEqual([]);
    expect(plan.fieldUpdates).toEqual([]);
  });

  it("keeps fields the change omits (partial change per differing items)", () => {
    const plan = planBulkEdit(
      [
        item({ id: "a", language: "en", condition: "LP" }),
        item({ id: "b", language: "es", condition: "MP" }),
      ],
      { condition: "NM" },
      [],
    );
    expect(plan.fieldUpdates).toEqual([
      { kind: "fieldUpdate", id: "a", collectionId: "col-1", foil: "NORMAL", language: "en", condition: "NM" },
      { kind: "fieldUpdate", id: "b", collectionId: "col-1", foil: "NORMAL", language: "es", condition: "NM" },
    ]);
  });

  it("ignores unselected items that don't match any target key", () => {
    const existing: ExistingItem[] = [
      { id: "existing-1", cardId: "card-9", collectionId: "col-1", foil: "NORMAL", language: "en", condition: "NM" },
    ];
    const plan = planBulkEdit([item({ id: "a" })], { condition: "LP" }, existing);
    expect(plan.existingIncrements).toEqual([]);
    expect(plan.fieldUpdates).toHaveLength(1);
  });

  it("returns an empty plan for an empty selection", () => {
    const plan = planBulkEdit([], { condition: "LP" }, []);
    expect(plan).toEqual({
      fieldUpdates: [],
      survivorUpdates: [],
      existingIncrements: [],
      deletedIds: [],
    });
  });
});
