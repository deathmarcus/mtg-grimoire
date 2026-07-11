const SCRYFALL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isScryfallId(id: string): boolean {
  return SCRYFALL_ID_RE.test(id);
}
