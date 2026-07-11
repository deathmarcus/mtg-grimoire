export const EXPORT_SCHEMA_VERSION = 1;

export type ExportCardRef = {
  id: string;
  name: string;
  setCode: string;
  collectorNumber: string;
};

export type CollectionExportItem = {
  quantity: number;
  foil: string;
  language: string;
  condition: string;
  acquiredPrice: number | null;
  notes: string | null;
  card: ExportCardRef;
};

export type WishlistExportItem = {
  quantityWanted: number;
  maxPriceUsd: number | null;
  priority: string;
  tag: string | null;
  notes: string | null;
  card: ExportCardRef;
};

export type DeckExportCard = {
  quantity: number;
  board: string;
  isCommander: boolean;
  category: string | null;
  card: ExportCardRef;
};

export type DeckExport = {
  name: string;
  format: string;
  cards: DeckExportCard[];
};

export type ExportOptions = { includeNotes: boolean };

function csvField(value: string | number | boolean | null): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(header: string[], rows: (string | number | boolean | null)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvField).join(","));
  return lines.join("\n") + "\n";
}

export function collectionToCsv(
  items: CollectionExportItem[],
  opts: ExportOptions
): string {
  // Column names follow the Manabox export format so the file can be
  // re-imported by parseManaboxCsv without changes.
  const header = [
    "Name",
    "Set code",
    "Collector number",
    "Scryfall ID",
    "Quantity",
    "Foil",
    "Condition",
    "Language",
    "Purchase price",
    "Purchase price currency",
    ...(opts.includeNotes ? ["Notes"] : []),
  ];
  const rows = items.map((it) => [
    it.card.name,
    it.card.setCode,
    it.card.collectorNumber,
    it.card.id,
    it.quantity,
    it.foil.toLowerCase(),
    it.condition,
    it.language,
    it.acquiredPrice,
    it.acquiredPrice != null ? "USD" : null,
    ...(opts.includeNotes ? [it.notes] : []),
  ]);
  return toCsv(header, rows);
}

export function wishlistToCsv(
  items: WishlistExportItem[],
  opts: ExportOptions
): string {
  const header = [
    "Name",
    "Set code",
    "Collector number",
    "Scryfall ID",
    "Quantity wanted",
    "Max price USD",
    "Priority",
    "Tag",
    ...(opts.includeNotes ? ["Notes"] : []),
  ];
  const rows = items.map((it) => [
    it.card.name,
    it.card.setCode,
    it.card.collectorNumber,
    it.card.id,
    it.quantityWanted,
    it.maxPriceUsd,
    it.priority,
    it.tag,
    ...(opts.includeNotes ? [it.notes] : []),
  ]);
  return toCsv(header, rows);
}

export function deckToCsv(deck: DeckExport): string {
  const header = [
    "Name",
    "Set code",
    "Collector number",
    "Scryfall ID",
    "Quantity",
    "Board",
    "Commander",
    "Category",
  ];
  const rows = deck.cards.map((dc) => [
    dc.card.name,
    dc.card.setCode,
    dc.card.collectorNumber,
    dc.card.id,
    dc.quantity,
    dc.board,
    dc.isCommander,
    dc.category,
  ]);
  return toCsv(header, rows);
}

type ExportType = "collection" | "wishlist" | "deck";

export function exportHref(
  type: ExportType,
  format: "csv" | "json",
  deckId?: string
): string {
  const qs = new URLSearchParams({ type, format });
  if (deckId) qs.set("deckId", deckId);
  return `/api/export?${qs.toString()}`;
}

export function toExportJson(
  type: ExportType,
  data: CollectionExportItem[] | WishlistExportItem[] | DeckExport,
  opts: ExportOptions
): {
  schemaVersion: number;
  type: ExportType;
  exportedAt: string;
  data: unknown;
} {
  const stripNotes = <T extends { notes?: string | null }>(x: T) => {
    if (opts.includeNotes) return x;
    const rest = { ...x };
    delete rest.notes;
    return rest;
  };
  const payload = Array.isArray(data)
    ? data.map((it) => stripNotes(it))
    : data;
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    type,
    exportedAt: new Date().toISOString(),
    data: payload,
  };
}
