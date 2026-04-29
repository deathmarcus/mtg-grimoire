// Shared Scryfall helpers.

export const SCRYFALL_API = "https://api.scryfall.com";

export function userAgent(): string {
  return (
    process.env.SCRYFALL_USER_AGENT ||
    "mtgcollection/0.1 (contact: set SCRYFALL_USER_AGENT in .env)"
  );
}

export function headers(): HeadersInit {
  return {
    "User-Agent": userAgent(),
    Accept: "application/json",
  };
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Scryfall ${res.status} ${res.statusText} for ${url}`);
  }
  return (await res.json()) as T;
}

// ---------- Types of interest on a Scryfall card ----------

export type ScryfallPrices = {
  usd: string | null;
  usd_foil: string | null;
  usd_etched: string | null;
  eur: string | null;
  eur_foil: string | null;
  tix: string | null;
};

export type ScryfallImageUris = {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
};

export type ScryfallCard = {
  id: string;
  oracle_id?: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  lang: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  image_uris?: ScryfallImageUris;
  card_faces?: Array<{ image_uris?: ScryfallImageUris }>;
  foil?: boolean;
  nonfoil?: boolean;
  finishes?: string[];
  prices: ScryfallPrices;
  released_at?: string;
  legalities?: Record<string, string>;
};

export type ScryfallBulkDataEntry = {
  object: "bulk_data";
  id: string;
  type: string;
  name: string;
  download_uri: string;
  updated_at: string;
  size: number;
};

export type ScryfallBulkDataList = {
  object: "list";
  data: ScryfallBulkDataEntry[];
};

// ---------- Card -> Prisma-ready row ----------

export type CardRow = {
  id: string;
  oracleId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  lang: string;
  manaCost: string | null;
  cmc: number | null;
  typeLine: string | null;
  oracleText: string | null;
  colors: string[];
  colorIdentity: string[];
  imageSmall: string | null;
  imageNormal: string | null;
  imageLarge: string | null;
  foilAvailable: boolean;
  nonfoilAvailable: boolean;
  etchedAvailable: boolean;
  latestUsd: string | null;
  latestUsdFoil: string | null;
  latestUsdEtched: string | null;
  legalities: Record<string, string> | null;
  scryfallUpdatedAt: Date | null;
};

export function toCardRow(c: ScryfallCard): CardRow {
  const imgs = c.image_uris ?? c.card_faces?.[0]?.image_uris ?? {};
  const finishes = c.finishes ?? [];
  return {
    id: c.id,
    oracleId: c.oracle_id ?? c.id,
    name: c.name,
    setCode: c.set,
    setName: c.set_name,
    collectorNumber: c.collector_number,
    rarity: c.rarity,
    lang: c.lang || "en",
    manaCost: c.mana_cost ?? null,
    cmc: typeof c.cmc === "number" ? c.cmc : null,
    typeLine: c.type_line ?? null,
    oracleText: c.oracle_text ?? null,
    colors: c.colors ?? [],
    colorIdentity: c.color_identity ?? [],
    imageSmall: imgs.small ?? null,
    imageNormal: imgs.normal ?? null,
    imageLarge: imgs.large ?? null,
    foilAvailable: c.foil ?? finishes.includes("foil"),
    nonfoilAvailable: c.nonfoil ?? finishes.includes("nonfoil"),
    etchedAvailable: finishes.includes("etched"),
    latestUsd: c.prices?.usd ?? null,
    latestUsdFoil: c.prices?.usd_foil ?? null,
    latestUsdEtched: c.prices?.usd_etched ?? null,
    legalities: c.legalities ?? null,
    scryfallUpdatedAt: c.released_at ? new Date(c.released_at) : null,
  };
}
