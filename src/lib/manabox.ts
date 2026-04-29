import { parse } from "csv-parse/sync";

export type ManaboxRow = {
  scryfallId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  foil: "NORMAL" | "FOIL" | "ETCHED";
  condition: "NM" | "LP" | "MP" | "HP" | "DMG";
  language: string;
  acquiredPrice: number | null;
  acquiredCurrency: string | null;
};

const FOIL_MAP: Record<string, ManaboxRow["foil"]> = {
  normal: "NORMAL",
  foil: "FOIL",
  etched: "ETCHED",
};

const CONDITION_MAP: Record<string, ManaboxRow["condition"]> = {
  nm: "NM",
  "near mint": "NM",
  lp: "LP",
  "lightly played": "LP",
  mp: "MP",
  "moderately played": "MP",
  hp: "HP",
  "heavily played": "HP",
  dmg: "DMG",
  damaged: "DMG",
};

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v !== "") return v;
  }
  return "";
}

export function parseManaboxCsv(text: string): {
  rows: ManaboxRow[];
  errors: string[];
} {
  const records = parse(text, {
    columns: (header: string[]) => header.map((h) => h.trim()),
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const rows: ManaboxRow[] = [];
  const errors: string[] = [];

  records.forEach((r, idx) => {
    const scryfallId = pick(r, "Scryfall ID", "scryfall_id", "ScryfallID");
    const name = pick(r, "Name", "name");
    if (!scryfallId) {
      errors.push(`Line ${idx + 2}: missing Scryfall ID (${name || "?"})`);
      return;
    }
    const foilRaw = pick(r, "Foil", "foil").toLowerCase();
    const condRaw = pick(r, "Condition", "condition").toLowerCase();
    const qtyRaw = pick(r, "Quantity", "quantity") || "1";
    const priceRaw = pick(r, "Purchase price", "purchase_price");
    const qty = Number.parseInt(qtyRaw, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      errors.push(`Line ${idx + 2}: invalid quantity "${qtyRaw}"`);
      return;
    }
    rows.push({
      scryfallId,
      name: name || "",
      setCode: pick(r, "Set code", "Set", "set").toLowerCase(),
      collectorNumber: pick(r, "Collector number", "collector_number"),
      quantity: qty,
      foil: FOIL_MAP[foilRaw] ?? "NORMAL",
      condition: CONDITION_MAP[condRaw] ?? "NM",
      language: pick(r, "Language", "language") || "en",
      acquiredPrice: priceRaw ? Number.parseFloat(priceRaw) || null : null,
      acquiredCurrency:
        pick(r, "Purchase price currency", "currency") || null,
    });
  });

  return { rows, errors };
}
