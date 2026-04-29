export type LegalityStatus = "legal" | "not_legal" | "banned" | "restricted";

export type Legality = {
  format: string;
  status: LegalityStatus;
};

// Order in which formats appear in the Rulings tab. Anything not listed here is
// appended alphabetically.
export const PRIMARY_FORMATS = [
  "standard",
  "pioneer",
  "modern",
  "legacy",
  "pauper",
  "commander",
  "vintage",
  "brawl",
  "historic",
] as const;

const STATUS_SET = new Set<LegalityStatus>([
  "legal",
  "not_legal",
  "banned",
  "restricted",
]);

const STATUS_LABEL: Record<LegalityStatus, string> = {
  legal: "Legal",
  not_legal: "Not legal",
  banned: "Banned",
  restricted: "Restricted",
};

export function formatLegalityStatus(s: LegalityStatus): string {
  return STATUS_LABEL[s];
}

export function parseLegalities(raw: unknown): Legality[] {
  if (raw == null) return [];
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return [];

  const entries: Legality[] = [];
  for (const [format, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const status: LegalityStatus = STATUS_SET.has(value as LegalityStatus)
      ? (value as LegalityStatus)
      : "not_legal";
    entries.push({ format, status });
  }

  const primaryIndex = (f: string): number => {
    const idx = (PRIMARY_FORMATS as readonly string[]).indexOf(f);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };

  entries.sort((a, b) => {
    const ai = primaryIndex(a.format);
    const bi = primaryIndex(b.format);
    if (ai !== bi) return ai - bi;
    return a.format.localeCompare(b.format);
  });

  return entries;
}
