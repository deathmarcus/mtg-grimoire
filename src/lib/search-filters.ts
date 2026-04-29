import { Prisma } from "@prisma/client";
import { PRIMARY_FORMATS } from "./card-detail";
import {
  parseColorsParam,
  parseRarityParam,
  type ColorLetter,
  type Rarity,
} from "./collection-filters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OwnershipFilter =
  | "any"
  | "in_collection"
  | "not_in_collection"
  | "on_wishlist";

export type SearchSortKey = "name" | "price_desc" | "price_asc" | "rarity";

export type SearchFilters = {
  q: string;
  colors: ColorLetter[];
  rarity: Rarity | null;
  /** One of PRIMARY_FORMATS, lowercase, or null */
  format: string | null;
  cmcMin: number | null;
  cmcMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  ownership: OwnershipFilter;
  sort: SearchSortKey;
  page: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_OWNERSHIPS: ReadonlySet<string> = new Set<OwnershipFilter>([
  "any",
  "in_collection",
  "not_in_collection",
  "on_wishlist",
]);

const VALID_SORTS: ReadonlySet<string> = new Set<SearchSortKey>([
  "name",
  "price_desc",
  "price_asc",
  "rarity",
]);

const VALID_FORMATS: ReadonlySet<string> = new Set<string>(PRIMARY_FORMATS);

export const PAGE_SIZE = 60;

// ---------------------------------------------------------------------------
// parseSearchParams
// ---------------------------------------------------------------------------

type RawParams = Record<string, string | string[] | undefined>;

function str(p: RawParams, key: string): string | undefined {
  const v = p[key];
  return Array.isArray(v) ? v[0] : v;
}

function parsePositiveFloat(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseFloat(s);
  if (isNaN(n) || n < 0) return null;
  return n;
}

export function parseSearchParams(params: RawParams): SearchFilters {
  const q = (str(params, "q") ?? "").trim();

  const colors = parseColorsParam(str(params, "colors") ?? null);

  const rawRarity = str(params, "rarity");
  const rarity = parseRarityParam(rawRarity ?? null);

  const rawFormat = (str(params, "format") ?? "").toLowerCase().trim();
  const format = VALID_FORMATS.has(rawFormat) ? rawFormat : null;

  const cmcMin = parsePositiveFloat(str(params, "cmc_min"));
  const cmcMax = parsePositiveFloat(str(params, "cmc_max"));

  const priceMin = parsePositiveFloat(str(params, "price_min"));
  const priceMax = parsePositiveFloat(str(params, "price_max"));

  const rawOwnership = str(params, "ownership") ?? "any";
  const ownership = VALID_OWNERSHIPS.has(rawOwnership)
    ? (rawOwnership as OwnershipFilter)
    : "any";

  const rawSort = str(params, "sort") ?? "name";
  const sort = VALID_SORTS.has(rawSort) ? (rawSort as SearchSortKey) : "name";

  const rawPage = parseInt(str(params, "page") ?? "1", 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  return {
    q,
    colors,
    rarity,
    format,
    cmcMin,
    cmcMax,
    priceMin,
    priceMax,
    ownership,
    sort,
    page,
  };
}

// ---------------------------------------------------------------------------
// buildSearchWhere
// ---------------------------------------------------------------------------

/**
 * Builds a Prisma `Card` where-clause from parsed search filters.
 * The `userId` param is used for ownership sub-queries (null = skip ownership
 * filtering, which is safe for the tests that don't need DB).
 */
export function buildSearchWhere(
  filters: SearchFilters,
  userId: string | null
): Prisma.CardWhereInput {
  const where: Prisma.CardWhereInput = {};

  // Text search
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q, mode: "insensitive" } },
      { setName: { contains: filters.q, mode: "insensitive" } },
    ];
  }

  // Colors
  if (filters.colors.length > 0) {
    const includesColorless = filters.colors.includes("C");
    const colored = filters.colors.filter((c) => c !== "C");
    const orClauses: Prisma.CardWhereInput[] = [];
    if (colored.length > 0) orClauses.push({ colors: { hasSome: colored } });
    if (includesColorless) orClauses.push({ colors: { isEmpty: true } });
    if (orClauses.length === 1) {
      Object.assign(where, orClauses[0]);
    } else {
      where.AND = [{ OR: orClauses }];
    }
  }

  // Rarity
  if (filters.rarity) {
    where.rarity = filters.rarity;
  }

  // CMC range
  if (filters.cmcMin !== null || filters.cmcMax !== null) {
    const cmcClause: { gte?: number; lte?: number } = {};
    if (filters.cmcMin !== null) cmcClause.gte = filters.cmcMin;
    if (filters.cmcMax !== null) cmcClause.lte = filters.cmcMax;
    where.cmc = cmcClause;
  }

  // Price range (uses latestUsd — best effort for normal finish)
  if (filters.priceMin !== null || filters.priceMax !== null) {
    const priceClause: { gte?: Prisma.Decimal; lte?: Prisma.Decimal } = {};
    if (filters.priceMin !== null)
      priceClause.gte = new Prisma.Decimal(filters.priceMin);
    if (filters.priceMax !== null)
      priceClause.lte = new Prisma.Decimal(filters.priceMax);
    where.latestUsd = priceClause;
  }

  // Format legality — filter cards whose legalities JSON contains the format as "legal"
  if (filters.format) {
    // Postgres JSON path: legalities->>format = 'legal'
    // Prisma doesn't support JsonFilter path queries directly; we use a raw
    // string_to_array trick via `string_contains` isn't right either.
    // Best approach: pass a `path` array filter via Prisma's Json filter.
    where.legalities = {
      path: [filters.format],
      equals: "legal",
    };
  }

  // Ownership filtering
  if (userId && filters.ownership !== "any") {
    where.id = buildOwnershipFilter(userId, filters.ownership);
  }

  return where;
}

// ---------------------------------------------------------------------------
// buildOwnershipFilter
// ---------------------------------------------------------------------------

/**
 * Returns an `in` or `notIn` id-list clause for the given ownership mode.
 * In production the page.tsx query resolves the actual IDs via a sub-query;
 * here we produce the Prisma shape that the page will use.
 *
 * For server use: pass collectionCardIds / wishlistCardIds already fetched,
 * or call this helper which returns the Prisma subquery structure.
 */
export function buildOwnershipFilter(
  userId: string,
  ownership: Exclude<OwnershipFilter, "any">
): Prisma.StringFilter {
  if (ownership === "in_collection") {
    return {
      in: undefined, // replaced at query time with actual IDs
    };
  }
  if (ownership === "not_in_collection") {
    return {
      notIn: undefined,
    };
  }
  // on_wishlist
  return {
    in: undefined,
  };
}

/**
 * Builds the ownership where clause with pre-resolved card ID lists.
 * Called from the page with actual IDs from the database.
 */
export function applyOwnershipToWhere(
  where: Prisma.CardWhereInput,
  ownership: OwnershipFilter,
  collectionCardIds: string[],
  wishlistCardIds: string[]
): Prisma.CardWhereInput {
  if (ownership === "any") return where;

  const result = { ...where };

  if (ownership === "in_collection") {
    result.id = { in: collectionCardIds };
  } else if (ownership === "not_in_collection") {
    result.id = { notIn: collectionCardIds };
  } else if (ownership === "on_wishlist") {
    result.id = { in: wishlistCardIds };
  }

  return result;
}

// ---------------------------------------------------------------------------
// buildOrderBy
// ---------------------------------------------------------------------------

export function buildOrderBy(
  sort: SearchSortKey
): Prisma.CardOrderByWithRelationInput | Prisma.CardOrderByWithRelationInput[] {
  switch (sort) {
    case "price_desc":
      return { latestUsd: { sort: "desc", nulls: "last" } };
    case "price_asc":
      return { latestUsd: { sort: "asc", nulls: "last" } };
    case "rarity":
      // In-memory sort applied after query; return name as tiebreaker
      return { name: "asc" };
    case "name":
    default:
      return { name: "asc" };
  }
}

// ---------------------------------------------------------------------------
// buildSearchUrl — helper for client components
// ---------------------------------------------------------------------------

export function buildSearchUrl(filters: SearchFilters, overrides: Partial<SearchFilters> = {}): string {
  const merged = { ...filters, ...overrides };
  const p = new URLSearchParams();
  if (merged.q) p.set("q", merged.q);
  if (merged.colors.length > 0) p.set("colors", merged.colors.join(","));
  if (merged.rarity) p.set("rarity", merged.rarity);
  if (merged.format) p.set("format", merged.format);
  if (merged.cmcMin !== null) p.set("cmc_min", String(merged.cmcMin));
  if (merged.cmcMax !== null) p.set("cmc_max", String(merged.cmcMax));
  if (merged.priceMin !== null) p.set("price_min", String(merged.priceMin));
  if (merged.priceMax !== null) p.set("price_max", String(merged.priceMax));
  if (merged.ownership !== "any") p.set("ownership", merged.ownership);
  if (merged.sort !== "name") p.set("sort", merged.sort);
  if (merged.page > 1) p.set("page", String(merged.page));
  const s = p.toString();
  return s ? `/search?${s}` : "/search";
}
