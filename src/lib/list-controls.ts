/**
 * View / Group / Sort primitives shared by /collection and /decks/[id].
 * Pure, side-effect-free — see list-controls.test.ts.
 */

export type ListViewMode = "text" | "stacks" | "grid";
export type GroupBy = "none" | "type" | "color" | "cmc" | "rarity" | "set";
export type SortBy = "name" | "price" | "cmc" | "quantity";

export const LIST_VIEW_MODES: ListViewMode[] = ["text", "stacks", "grid"];
export const GROUP_BY_OPTIONS: GroupBy[] = ["none", "type", "color", "cmc", "rarity", "set"];
export const SORT_BY_OPTIONS: SortBy[] = ["name", "price", "cmc", "quantity"];

/** Minimal structural card shape needed to group/sort — matches both Card and ClientDeckCard["card"]. */
export interface ListCardShape {
  name: string;
  typeLine: string;
  colors: string[];
  cmc: number;
  rarity: string;
  setCode: string;
}

/** Minimal structural item shape. Extra properties on T are preserved through group/sort. */
export interface ListItem {
  card: ListCardShape;
  quantity: number;
  /** Unit price used for the "price" sort. Caller resolves finish/foil pricing before calling. */
  price: number | null;
}

export interface GroupResult<T> {
  key: string;
  label: string;
  items: T[];
}

// ── Type grouping ───────────────────────────────────────────────────────────

const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Land",
  "Other",
] as const;

export type TypeGroup = (typeof TYPE_ORDER)[number];

export function getTypeGroup(typeLine: string): TypeGroup {
  for (const t of TYPE_ORDER) {
    if (t === "Other") return "Other";
    if (typeLine.includes(t)) return t;
  }
  return "Other";
}

// ── Color grouping ──────────────────────────────────────────────────────────

const COLOR_ORDER = ["W", "U", "B", "R", "G"] as const;

function getColorGroup(colors: string[]): string {
  if (colors.length === 0) return "Colorless";
  if (colors.length > 1) return "Multicolor";
  return colors[0];
}

// ── Rarity grouping (mythic > rare > uncommon > common, unknowns alphabetically) ──

const RARITY_ORDER = ["mythic", "rare", "uncommon", "common"];

function rarityRank(rarity: string): number {
  const idx = RARITY_ORDER.indexOf(rarity.toLowerCase());
  return idx === -1 ? RARITY_ORDER.length : idx;
}

// ── CMC bucketing (0,1,...,6,7+) ─────────────────────────────────────────────

function cmcBucketKey(cmc: number): string {
  const bucket = Math.max(0, Math.floor(cmc));
  return bucket >= 7 ? "7+" : String(bucket);
}

// ── groupCards ───────────────────────────────────────────────────────────────

/**
 * Buckets items into canonically-ordered groups. Does NOT sort within a group —
 * callers that also want sorting should call sortCards(items, sortBy) first;
 * Array.sort is stable and Map preserves insertion order, so the sort order
 * carries through into each bucket.
 */
export function groupCards<T extends ListItem>(items: T[], groupBy: GroupBy): GroupResult<T>[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "", items: [...items] }];
  }

  const buckets = new Map<string, T[]>();
  const pushTo = (key: string, item: T) => {
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  };

  for (const item of items) {
    switch (groupBy) {
      case "type":
        pushTo(getTypeGroup(item.card.typeLine), item);
        break;
      case "color":
        pushTo(getColorGroup(item.card.colors), item);
        break;
      case "cmc":
        pushTo(cmcBucketKey(item.card.cmc), item);
        break;
      case "rarity":
        pushTo(item.card.rarity.toLowerCase(), item);
        break;
      case "set":
        pushTo(item.card.setCode.toLowerCase(), item);
        break;
    }
  }

  const orderedKeys = canonicalKeyOrder(groupBy, Array.from(buckets.keys()));

  return orderedKeys.map((key) => ({
    key,
    label: groupLabel(groupBy, key),
    items: buckets.get(key)!,
  }));
}

function canonicalKeyOrder(groupBy: GroupBy, keys: string[]): string[] {
  switch (groupBy) {
    case "type":
      return TYPE_ORDER.filter((t) => keys.includes(t));
    case "color": {
      const canonical = [...COLOR_ORDER, "Multicolor", "Colorless"];
      return canonical.filter((c) => keys.includes(c));
    }
    case "cmc":
      return keys.sort((a, b) => {
        if (a === "7+") return 1;
        if (b === "7+") return -1;
        return Number(a) - Number(b);
      });
    case "rarity":
      return keys.sort((a, b) => rarityRank(a) - rarityRank(b) || a.localeCompare(b));
    case "set":
      return keys.sort((a, b) => a.localeCompare(b));
    default:
      return keys;
  }
}

function groupLabel(groupBy: GroupBy, key: string): string {
  switch (groupBy) {
    case "set":
      return key.toUpperCase();
    case "rarity":
      return key[0].toUpperCase() + key.slice(1);
    default:
      return key;
  }
}

// ── sortCards ────────────────────────────────────────────────────────────────

export function sortCards<T extends ListItem>(items: T[], sortBy: SortBy): T[] {
  const byName = (a: T, b: T) => a.card.name.localeCompare(b.card.name);

  return [...items].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return byName(a, b);
      case "price": {
        const pa = a.price ?? -Infinity;
        const pb = b.price ?? -Infinity;
        return pb - pa || byName(a, b);
      }
      case "cmc":
        return a.card.cmc - b.card.cmc || byName(a, b);
      case "quantity":
        return b.quantity - a.quantity || byName(a, b);
      default:
        return byName(a, b);
    }
  });
}
