/**
 * MTG Arena export format parser.
 *
 * Parses lines in the format: N CardName (SET) CollectorNumber
 * where N = quantity (integer), SET = 3-4 uppercase letters/digits,
 * and CollectorNumber = alphanumeric (may include letters, e.g. "278a").
 *
 * Skips: empty lines, lines starting with "//", "Deck", "Sideboard".
 */

import { parseDeckLine } from "./deck-line-parser";

export type ArenaRow = {
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
};

// Arena set codes are 3-4 alphanumeric characters (e.g. M11, MH21, TSR).
// This is stricter than the shared line format, which accepts any
// non-")" text as the set group — so we validate on top of parseDeckLine
// rather than loosen it for the other consumers.
const ARENA_SET_RE = /^[A-Z0-9]{3,4}$/;

export function parseArenaTxt(text: string): ArenaRow[] {
  const rows: ArenaRow[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, section headers
    if (!trimmed) continue;
    if (trimmed.startsWith("//")) continue;
    if (trimmed === "Deck" || trimmed === "Sideboard") continue;

    const parsed = parseDeckLine(trimmed);
    if (!parsed) continue;
    if (!ARENA_SET_RE.test(parsed.setCode)) continue;

    rows.push({
      quantity: parsed.quantity,
      name: parsed.name,
      setCode: parsed.setCode,
      collectorNumber: parsed.collectorNumber,
    });
  }

  return rows;
}
