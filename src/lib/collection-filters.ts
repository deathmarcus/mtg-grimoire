export type ColorLetter = "W" | "U" | "B" | "R" | "G" | "C";
export type Rarity = "common" | "uncommon" | "rare" | "mythic";
export type SortKey = "price" | "name" | "rarity";

const VALID_COLORS: ReadonlySet<ColorLetter> = new Set(["W", "U", "B", "R", "G", "C"]);
const VALID_RARITIES: ReadonlySet<Rarity> = new Set([
  "common",
  "uncommon",
  "rare",
  "mythic",
]);
const VALID_SORTS: ReadonlySet<SortKey> = new Set(["price", "name", "rarity"]);

export function parseColorsParam(p: string | null | undefined): ColorLetter[] {
  if (!p) return [];
  const seen = new Set<ColorLetter>();
  const out: ColorLetter[] = [];
  for (const part of p.split(",")) {
    const c = part.trim().toUpperCase();
    if (VALID_COLORS.has(c as ColorLetter) && !seen.has(c as ColorLetter)) {
      seen.add(c as ColorLetter);
      out.push(c as ColorLetter);
    }
  }
  return out;
}

export function toggleColor(current: ColorLetter[], color: ColorLetter): ColorLetter[] {
  return current.includes(color)
    ? current.filter((c) => c !== color)
    : [...current, color];
}

export function parseRarityParam(p: string | null | undefined): Rarity | null {
  if (!p) return null;
  const r = p.trim().toLowerCase();
  return VALID_RARITIES.has(r as Rarity) ? (r as Rarity) : null;
}

export function parseSortParam(p: string | null | undefined): SortKey {
  if (!p) return "name";
  const s = p.trim().toLowerCase();
  return VALID_SORTS.has(s as SortKey) ? (s as SortKey) : "name";
}

const RARITY_RANK: Record<string, number> = {
  mythic: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
};

export function rarityOrder(rarity: string): number {
  return RARITY_RANK[rarity.toLowerCase()] ?? 99;
}
