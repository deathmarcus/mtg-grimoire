import { describe, it, expect } from "vitest";
import {
  parseSearchParams,
  type OwnershipFilter,
  type SearchSortKey,
} from "./search-filters";

// ---------------------------------------------------------------------------
// parseSearchParams
// ---------------------------------------------------------------------------

describe("parseSearchParams — defaults", () => {
  it("returns default values for empty input", () => {
    const f = parseSearchParams({});
    expect(f.q).toBe("");
    expect(f.colors).toEqual([]);
    expect(f.rarity).toBeNull();
    expect(f.format).toBeNull();
    expect(f.cmcMin).toBeNull();
    expect(f.cmcMax).toBeNull();
    expect(f.priceMin).toBeNull();
    expect(f.priceMax).toBeNull();
    expect(f.ownership).toBe<OwnershipFilter>("any");
    expect(f.sort).toBe<SearchSortKey>("name");
    expect(f.page).toBe(1);
  });

  it("trims whitespace from q", () => {
    const f = parseSearchParams({ q: "  lightning  " });
    expect(f.q).toBe("lightning");
  });
});

describe("parseSearchParams — colors", () => {
  it("parses comma-separated colors", () => {
    const f = parseSearchParams({ colors: "W,U,R" });
    expect(f.colors).toEqual(["W", "U", "R"]);
  });

  it("deduplicates colors", () => {
    const f = parseSearchParams({ colors: "R,R,G" });
    expect(f.colors).toEqual(["R", "G"]);
  });

  it("ignores invalid color letters", () => {
    const f = parseSearchParams({ colors: "W,X,Z" });
    expect(f.colors).toEqual(["W"]);
  });

  it("accepts colorless C", () => {
    const f = parseSearchParams({ colors: "C" });
    expect(f.colors).toEqual(["C"]);
  });
});

describe("parseSearchParams — rarity", () => {
  it("parses valid rarity", () => {
    expect(parseSearchParams({ rarity: "rare" }).rarity).toBe("rare");
    expect(parseSearchParams({ rarity: "mythic" }).rarity).toBe("mythic");
    expect(parseSearchParams({ rarity: "common" }).rarity).toBe("common");
    expect(parseSearchParams({ rarity: "uncommon" }).rarity).toBe("uncommon");
  });

  it("returns null for invalid rarity", () => {
    expect(parseSearchParams({ rarity: "super-rare" }).rarity).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(parseSearchParams({ rarity: "RARE" }).rarity).toBe("rare");
  });
});

describe("parseSearchParams — format", () => {
  it("accepts known formats", () => {
    expect(parseSearchParams({ format: "modern" }).format).toBe("modern");
    expect(parseSearchParams({ format: "commander" }).format).toBe("commander");
    expect(parseSearchParams({ format: "legacy" }).format).toBe("legacy");
  });

  it("returns null for unknown format", () => {
    expect(parseSearchParams({ format: "oathbreaker" }).format).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(parseSearchParams({ format: "MODERN" }).format).toBe("modern");
  });
});

describe("parseSearchParams — CMC range", () => {
  it("parses cmc_min and cmc_max as numbers", () => {
    const f = parseSearchParams({ cmc_min: "2", cmc_max: "5" });
    expect(f.cmcMin).toBe(2);
    expect(f.cmcMax).toBe(5);
  });

  it("returns null for non-numeric cmc values", () => {
    const f = parseSearchParams({ cmc_min: "abc", cmc_max: "" });
    expect(f.cmcMin).toBeNull();
    expect(f.cmcMax).toBeNull();
  });

  it("returns null for negative cmc values", () => {
    const f = parseSearchParams({ cmc_min: "-1" });
    expect(f.cmcMin).toBeNull();
  });
});

describe("parseSearchParams — price range", () => {
  it("parses price_min and price_max as numbers", () => {
    const f = parseSearchParams({ price_min: "1.5", price_max: "50" });
    expect(f.priceMin).toBe(1.5);
    expect(f.priceMax).toBe(50);
  });

  it("returns null for non-numeric price values", () => {
    const f = parseSearchParams({ price_min: "abc" });
    expect(f.priceMin).toBeNull();
  });
});

describe("parseSearchParams — ownership", () => {
  it("parses valid ownership values", () => {
    expect(parseSearchParams({ ownership: "any" }).ownership).toBe("any");
    expect(parseSearchParams({ ownership: "in_collection" }).ownership).toBe("in_collection");
    expect(parseSearchParams({ ownership: "not_in_collection" }).ownership).toBe("not_in_collection");
    expect(parseSearchParams({ ownership: "on_wishlist" }).ownership).toBe("on_wishlist");
  });

  it("falls back to any for unknown ownership", () => {
    expect(parseSearchParams({ ownership: "owned" }).ownership).toBe("any");
  });
});

describe("parseSearchParams — sort", () => {
  it("accepts valid sort keys", () => {
    expect(parseSearchParams({ sort: "name" }).sort).toBe("name");
    expect(parseSearchParams({ sort: "price_desc" }).sort).toBe("price_desc");
    expect(parseSearchParams({ sort: "price_asc" }).sort).toBe("price_asc");
    expect(parseSearchParams({ sort: "rarity" }).sort).toBe("rarity");
  });

  it("falls back to name for unknown sort", () => {
    expect(parseSearchParams({ sort: "value" }).sort).toBe("name");
  });
});

describe("parseSearchParams — page", () => {
  it("parses valid page number", () => {
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
  });

  it("clamps page to minimum 1", () => {
    expect(parseSearchParams({ page: "0" }).page).toBe(1);
    expect(parseSearchParams({ page: "-5" }).page).toBe(1);
  });

  it("defaults to 1 for non-numeric page", () => {
    expect(parseSearchParams({ page: "abc" }).page).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildSearchWhere — structural / logic tests (no DB)
// ---------------------------------------------------------------------------

import { buildSearchWhere } from "./search-filters";

describe("buildSearchWhere — text query", () => {
  it("adds OR clause for q when non-empty", () => {
    const where = buildSearchWhere({ q: "lightning", colors: [], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect(where.OR).toBeDefined();
    // Should search name and setName
    const orArr = where.OR as Array<{ name?: unknown; setName?: unknown }>;
    expect(orArr.some((c) => "name" in c)).toBe(true);
    expect(orArr.some((c) => "setName" in c)).toBe(true);
  });

  it("omits OR clause when q is empty", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect(where.OR).toBeUndefined();
  });
});

describe("buildSearchWhere — colors", () => {
  it("adds hasSome clause for colored filter", () => {
    const where = buildSearchWhere({ q: "", colors: ["R", "G"], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    // Colors is in the where object directly or via AND/OR
    const str = JSON.stringify(where);
    expect(str).toContain("hasSome");
  });

  it("adds isEmpty clause when C (colorless) is selected alone", () => {
    const where = buildSearchWhere({ q: "", colors: ["C"], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    const str = JSON.stringify(where);
    expect(str).toContain("isEmpty");
  });

  it("omits color clause when colors is empty", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    const str = JSON.stringify(where);
    expect(str).not.toContain("hasSome");
    expect(str).not.toContain("isEmpty");
  });
});

describe("buildSearchWhere — rarity", () => {
  it("adds rarity filter when set", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: "rare", format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect(where.rarity).toBe("rare");
  });

  it("omits rarity filter when null", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect(where.rarity).toBeUndefined();
  });
});

describe("buildSearchWhere — CMC range", () => {
  it("adds gte for cmcMin", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: 2, cmcMax: null, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect((where.cmc as { gte?: number })?.gte).toBe(2);
  });

  it("adds lte for cmcMax", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: null, cmcMax: 5, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect((where.cmc as { lte?: number })?.lte).toBe(5);
  });

  it("combines both gte and lte", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: 2, cmcMax: 5, priceMin: null, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect((where.cmc as { gte?: number; lte?: number })?.gte).toBe(2);
    expect((where.cmc as { gte?: number; lte?: number })?.lte).toBe(5);
  });
});

describe("buildSearchWhere — price range", () => {
  it("adds gte for priceMin", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: 5, priceMax: null, ownership: "any", sort: "name", page: 1 }, null);
    expect((where.latestUsd as { gte?: unknown })?.gte).toBeDefined();
  });

  it("adds lte for priceMax", () => {
    const where = buildSearchWhere({ q: "", colors: [], rarity: null, format: null, cmcMin: null, cmcMax: null, priceMin: null, priceMax: 100, ownership: "any", sort: "name", page: 1 }, null);
    expect((where.latestUsd as { lte?: unknown })?.lte).toBeDefined();
  });
});
