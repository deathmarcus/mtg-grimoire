/**
 * Shared line parser for the "qty name (set) collectorNumber" format used by
 * Moxfield exports, Arena exports, and the combined deck-import flow.
 *
 * Format: `<quantity> <name> (<setCode>) <collectorNumber>`
 * - quantity: one or more digits
 * - name: any text (non-greedy — backtracks to find the trailing group)
 * - setCode: anything except a closing paren
 * - collectorNumber: a single non-whitespace token at the end of the line
 *
 * Callers that need a stricter setCode shape (e.g. Arena's 3-4 uppercase
 * alphanumeric constraint) should validate `setCode` themselves after
 * calling this — see `arena-parser.ts`.
 */

export type DeckLine = {
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
};

const DECK_LINE_RE = /^(\d+)\s+(.+?)\s+\(([^)]+)\)\s+(\S+)$/;

export function parseDeckLine(line: string): DeckLine | null {
  const m = line.match(DECK_LINE_RE);
  if (!m) return null;
  return {
    quantity: Number(m[1]),
    name: m[2].trim(),
    setCode: m[3],
    collectorNumber: m[4],
  };
}
