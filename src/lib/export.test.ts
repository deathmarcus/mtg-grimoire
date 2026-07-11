import { describe, it, expect } from "vitest";
import {
  EXPORT_SCHEMA_VERSION,
  collectionToCsv,
  wishlistToCsv,
  deckToCsv,
  toExportJson,
  type CollectionExportItem,
  type WishlistExportItem,
  type DeckExport,
} from "./export";
import { exportHref } from "./export";
import { parseManaboxCsv } from "./manabox";

describe("exportHref", () => {
  it("builds collection/wishlist URLs", () => {
    expect(exportHref("collection", "csv")).toBe(
      "/api/export?type=collection&format=csv"
    );
    expect(exportHref("wishlist", "json")).toBe(
      "/api/export?type=wishlist&format=json"
    );
  });

  it("includes deckId for decks", () => {
    expect(exportHref("deck", "csv", "d1")).toBe(
      "/api/export?type=deck&format=csv&deckId=d1"
    );
  });
});

const collectionItems: CollectionExportItem[] = [
  {
    quantity: 4,
    foil: "NORMAL",
    language: "en",
    condition: "NM",
    acquiredPrice: 0.25,
    notes: "from draft, \"keep\"",
    card: {
      id: "abc-123",
      name: 'Kellan, the "Kid"',
      setCode: "otj",
      collectorNumber: "225",
    },
  },
  {
    quantity: 1,
    foil: "FOIL",
    language: "es",
    condition: "LP",
    acquiredPrice: null,
    notes: null,
    card: {
      id: "def-456",
      name: "Llanowar Elves",
      setCode: "m19",
      collectorNumber: "314",
    },
  },
];

describe("collectionToCsv", () => {
  it("round-trips through parseManaboxCsv", () => {
    const csv = collectionToCsv(collectionItems, { includeNotes: false });
    const { rows, errors } = parseManaboxCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      scryfallId: "abc-123",
      name: 'Kellan, the "Kid"',
      setCode: "otj",
      collectorNumber: "225",
      quantity: 4,
      foil: "NORMAL",
      condition: "NM",
      language: "en",
      acquiredPrice: 0.25,
    });
    expect(rows[1]).toMatchObject({
      scryfallId: "def-456",
      quantity: 1,
      foil: "FOIL",
      condition: "LP",
      language: "es",
      acquiredPrice: null,
    });
  });

  it("omits notes column by default", () => {
    const csv = collectionToCsv(collectionItems, { includeNotes: false });
    expect(csv).not.toContain("Notes");
    expect(csv).not.toContain("keep");
  });

  it("includes notes column when opted in, with proper escaping", () => {
    const csv = collectionToCsv(collectionItems, { includeNotes: true });
    const header = csv.split("\n")[0];
    expect(header).toContain("Notes");
    expect(csv).toContain('"from draft, ""keep"""');
  });
});

describe("wishlistToCsv", () => {
  const items: WishlistExportItem[] = [
    {
      quantityWanted: 2,
      maxPriceUsd: 15.5,
      priority: "HIGH",
      tag: "edh",
      notes: "secret",
      card: {
        id: "ghi-789",
        name: "Rhystic Study",
        setCode: "pcy",
        collectorNumber: "45",
      },
    },
  ];

  it("emits one row per item with wishlist fields", () => {
    const csv = wishlistToCsv(items, { includeNotes: false });
    const [header, row] = csv.trim().split("\n");
    expect(header).toBe(
      "Name,Set code,Collector number,Scryfall ID,Quantity wanted,Max price USD,Priority,Tag"
    );
    expect(row).toBe("Rhystic Study,pcy,45,ghi-789,2,15.5,HIGH,edh");
  });

  it("keeps notes opt-in", () => {
    expect(wishlistToCsv(items, { includeNotes: false })).not.toContain("secret");
    expect(wishlistToCsv(items, { includeNotes: true })).toContain("secret");
  });
});

describe("deckToCsv", () => {
  const deck: DeckExport = {
    name: "Xyris Wheels",
    format: "Commander",
    cards: [
      {
        quantity: 1,
        board: "MAIN",
        isCommander: true,
        category: null,
        card: {
          id: "xyz-1",
          name: "Xyris, the Writhing Storm",
          setCode: "c20",
          collectorNumber: "17",
        },
      },
      {
        quantity: 1,
        board: "CONSIDERING",
        isCommander: false,
        category: "Draw",
        card: {
          id: "xyz-2",
          name: "Windfall",
          setCode: "c20",
          collectorNumber: "128",
        },
      },
    ],
  };

  it("emits board, commander flag and category per row", () => {
    const csv = deckToCsv(deck);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "Name,Set code,Collector number,Scryfall ID,Quantity,Board,Commander,Category"
    );
    expect(lines[1]).toBe(
      '"Xyris, the Writhing Storm",c20,17,xyz-1,1,MAIN,true,'
    );
    expect(lines[2]).toBe("Windfall,c20,128,xyz-2,1,CONSIDERING,false,Draw");
  });
});

describe("toExportJson", () => {
  it("wraps payload with schema version and type", () => {
    const out = toExportJson("collection", collectionItems, {
      includeNotes: false,
    });
    expect(out.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(out.type).toBe("collection");
    expect(Array.isArray(out.data)).toBe(true);
    expect(out.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("strips notes unless opted in", () => {
    const withoutNotes = toExportJson("collection", collectionItems, {
      includeNotes: false,
    });
    expect(JSON.stringify(withoutNotes)).not.toContain("keep");
    const withNotes = toExportJson("collection", collectionItems, {
      includeNotes: true,
    });
    expect(JSON.stringify(withNotes)).toContain("keep");
  });
});
