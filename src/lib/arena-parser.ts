/**
 * MTG Arena export format parser.
 *
 * Parses lines in the format: N CardName (SET) CollectorNumber
 * where N = quantity (integer), SET = 3-4 uppercase letters/digits,
 * and CollectorNumber = alphanumeric (may include letters, e.g. "278a").
 *
 * Skips: empty lines, lines starting with "//", "Deck", "Sideboard".
 */

export type ArenaRow = {
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
};

// Matches: <qty> <name> (<SET>) <collectorNumber>
// SET: 3-4 alphanumeric characters (e.g. M11, MH21, TSR)
// collectorNumber: one or more word characters (digits + optional trailing letters)
const ARENA_LINE_RE = /^(\d+)\s+(.+?)\s+\(([A-Z0-9]{3,4})\)\s+(\S+)$/;

export function parseArenaTxt(text: string): ArenaRow[] {
  const rows: ArenaRow[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, section headers
    if (!trimmed) continue;
    if (trimmed.startsWith("//")) continue;
    if (trimmed === "Deck" || trimmed === "Sideboard") continue;

    const m = trimmed.match(ARENA_LINE_RE);
    if (!m) continue;

    rows.push({
      quantity: Number(m[1]),
      name: m[2].trim(),
      setCode: m[3],
      collectorNumber: m[4],
    });
  }

  return rows;
}
