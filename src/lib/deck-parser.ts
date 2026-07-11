import { parseDeckLine } from "./deck-line-parser";

export type DeckRow = {
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
};

type ParseResult = { rows: DeckRow[]; errors: string[] };

export function parseMoxfieldTxt(input: string): ParseResult {
  const rows: DeckRow[] = [];
  const errors: string[] = [];
  const lines = input.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("//")) continue;

    const parsed = parseDeckLine(line);
    if (!parsed) {
      errors.push(`Line ${i + 1}: could not parse "${line}"`);
      continue;
    }
    rows.push(parsed);
  }

  return { rows, errors };
}

export function parseArchidektCsv(input: string): ParseResult {
  const rows: DeckRow[] = [];
  const errors: string[] = [];
  const lines = input.split(/\r?\n/);

  if (lines.length < 2) {
    errors.push("CSV must have a header row and at least one data row");
    return { rows, errors };
  }

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCsvLine(line);
    const qty = Number(fields[0]);
    const name = fields[1]?.trim();
    const setCode = fields[2]?.trim();
    const collectorNumber = fields[3]?.trim();

    if (!name || !setCode || !collectorNumber || isNaN(qty) || qty < 1) {
      errors.push(`Row ${i + 1}: missing or invalid fields`);
      continue;
    }

    rows.push({ quantity: qty, name, setCode, collectorNumber });
  }

  return { rows, errors };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseDeckList(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { rows: [], errors: ["Input is empty"] };
  }

  const firstLine = trimmed.split(/\r?\n/)[0];
  if (firstLine.includes("Quantity,") || firstLine.includes("Name,")) {
    return parseArchidektCsv(trimmed);
  }
  return parseMoxfieldTxt(trimmed);
}
