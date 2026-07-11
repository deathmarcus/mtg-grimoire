import { describe, it, expect } from "vitest";
import {
  getTypeGroup,
  groupCards,
  sortCards,
  type ListItem,
} from "./list-controls";

function item(overrides: Partial<ListItem["card"]> & { quantity?: number; price?: number | null }): ListItem {
  const { quantity = 1, price = null, ...card } = overrides;
  return {
    quantity,
    price,
    card: {
      name: "Card",
      typeLine: "Creature — Human",
      colors: [],
      cmc: 0,
      rarity: "common",
      setCode: "abc",
      ...card,
    },
  };
}

describe("getTypeGroup", () => {
  it("matches Legendary Creature typeLine to Creature", () => {
    expect(getTypeGroup("Legendary Creature — Human Wizard")).toBe("Creature");
  });

  it("matches Planeswalker before Creature is irrelevant, direct match works", () => {
    expect(getTypeGroup("Legendary Planeswalker — Jace")).toBe("Planeswalker");
  });

  it("falls back to Other for unknown type lines", () => {
    expect(getTypeGroup("Conspiracy")).toBe("Other");
  });

  it("classifies a land that also says Artifact as Artifact (current documented behavior)", () => {
    expect(getTypeGroup("Artifact Land")).toBe("Artifact");
  });

  it("classifies plain Land", () => {
    expect(getTypeGroup("Land")).toBe("Land");
  });
});

describe("groupCards", () => {
  it("returns a single 'none' group preserving all items when groupBy is none", () => {
    const items = [item({ name: "B" }), item({ name: "A" })];
    const groups = groupCards(items, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
  });

  it("groups by type in canonical order, dropping empty groups", () => {
    const items = [
      item({ name: "Bolt", typeLine: "Instant" }),
      item({ name: "Goblin", typeLine: "Creature — Goblin" }),
      item({ name: "Sign in Blood", typeLine: "Sorcery" }),
    ];
    const groups = groupCards(items, "type");
    expect(groups.map((g) => g.key)).toEqual(["Creature", "Instant", "Sorcery"]);
  });

  it("groups by color: W/U/B/R/G/Multicolor/Colorless, empty colors -> Colorless", () => {
    const items = [
      item({ name: "White card", colors: ["W"] }),
      item({ name: "Multicolor card", colors: ["W", "U"] }),
      item({ name: "Colorless card", colors: [] }),
    ];
    const groups = groupCards(items, "color");
    expect(groups.map((g) => g.key)).toEqual(["W", "Multicolor", "Colorless"]);
  });

  it("groups by cmc into buckets 0..7+", () => {
    const items = [
      item({ name: "Zero", cmc: 0 }),
      item({ name: "Seven", cmc: 7 }),
      item({ name: "Ten", cmc: 10 }),
      item({ name: "Two", cmc: 2 }),
    ];
    const groups = groupCards(items, "cmc");
    expect(groups.map((g) => g.key)).toEqual(["0", "2", "7+"]);
    // both cmc 7 and cmc 10 collapse into the 7+ bucket
    expect(groups.find((g) => g.key === "7+")!.items).toHaveLength(2);
  });

  it("groups by rarity in mythic > rare > uncommon > common order", () => {
    const items = [
      item({ name: "C", rarity: "common" }),
      item({ name: "M", rarity: "mythic" }),
      item({ name: "R", rarity: "rare" }),
      item({ name: "U", rarity: "uncommon" }),
    ];
    const groups = groupCards(items, "rarity");
    expect(groups.map((g) => g.key)).toEqual(["mythic", "rare", "uncommon", "common"]);
  });

  it("does not sort within a group — callers must sortCards first (stable order carries through)", () => {
    const items = [
      item({ name: "Zeta", typeLine: "Creature" }),
      item({ name: "Alpha", typeLine: "Creature" }),
    ];
    const sortedThenGrouped = groupCards(sortCards(items, "name"), "type");
    expect(sortedThenGrouped[0].items.map((i) => i.card.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("groups by set alphabetically by set code", () => {
    const items = [
      item({ name: "A", setCode: "znr" }),
      item({ name: "B", setCode: "afr" }),
      item({ name: "C", setCode: "mid" }),
    ];
    const groups = groupCards(items, "set");
    expect(groups.map((g) => g.key)).toEqual(["afr", "mid", "znr"]);
  });
});

describe("sortCards", () => {
  it("sorts by name ascending", () => {
    const items = [item({ name: "Zeta" }), item({ name: "Alpha" }), item({ name: "Mid" })];
    const sorted = sortCards(items, "name");
    expect(sorted.map((i) => i.card.name)).toEqual(["Alpha", "Mid", "Zeta"]);
  });

  it("sorts by price descending, ties broken by name, nulls sort last", () => {
    const items = [
      item({ name: "NullPrice", price: null }),
      item({ name: "B", price: 5 }),
      item({ name: "A", price: 5 }),
      item({ name: "High", price: 20 }),
    ];
    const sorted = sortCards(items, "price");
    expect(sorted.map((i) => i.card.name)).toEqual(["High", "A", "B", "NullPrice"]);
  });

  it("sorts by cmc ascending, ties broken by name", () => {
    const items = [
      item({ name: "B", cmc: 2 }),
      item({ name: "A", cmc: 2 }),
      item({ name: "Zero", cmc: 0 }),
    ];
    const sorted = sortCards(items, "cmc");
    expect(sorted.map((i) => i.card.name)).toEqual(["Zero", "A", "B"]);
  });

  it("sorts by quantity descending, ties broken by name", () => {
    const items = [
      item({ name: "B", quantity: 3 }),
      item({ name: "A", quantity: 3 }),
      item({ name: "Solo", quantity: 1 }),
    ];
    const sorted = sortCards(items, "quantity");
    expect(sorted.map((i) => i.card.name)).toEqual(["A", "B", "Solo"]);
  });
});
