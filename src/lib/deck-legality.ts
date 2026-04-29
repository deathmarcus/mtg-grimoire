import { PRIMARY_FORMATS } from "./card-detail";

/**
 * Result: a mapping of format → whether the deck is legal in that format.
 * A deck is legal in a format if ALL its cards are legal or restricted in it.
 * "not_legal" or "banned" → illegal.
 * Missing entry for a format → treated as not_legal (assume unknown = illegal).
 */
export type DeckLegalityResult = Record<string, boolean>;

type CardLike = {
  legalities: unknown;
};

/** Extract a Record<format, status> from an unknown legalities value. */
function extractLegalitiesMap(raw: unknown): Record<string, string> {
  if (raw == null) return {};
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return {};
  // Only keep string-valued entries
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

/**
 * Check deck legality across all formats.
 *
 * A format is legal if:
 *   - Every card in the deck has a "legal" or "restricted" status for that format.
 *   - If a card has no entry for a format, it is treated as "not_legal".
 *
 * The result always includes all PRIMARY_FORMATS plus any additional formats
 * found in the cards' legality data.
 */
export function checkDeckLegality(cards: CardLike[]): DeckLegalityResult {
  // Collect all formats we care about: base set + any extra from cards
  const allFormats = new Set<string>(PRIMARY_FORMATS);
  const cardMaps = cards.map((c) => {
    const m = extractLegalitiesMap(c.legalities);
    for (const f of Object.keys(m)) allFormats.add(f);
    return m;
  });

  const result: DeckLegalityResult = {};

  for (const format of allFormats) {
    if (cards.length === 0) {
      // Empty deck: vacuously legal in all formats
      result[format] = true;
      continue;
    }

    let isLegal = true;
    for (const map of cardMaps) {
      const status = map[format] ?? "not_legal";
      // "legal" or "restricted" → ok for this card+format
      if (status !== "legal" && status !== "restricted") {
        isLegal = false;
        break;
      }
    }
    result[format] = isLegal;
  }

  return result;
}
