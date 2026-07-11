// F7 (#20): Set completion — pure helpers for /sets and /sets/[setCode].

// ---------------------------------------------------------------------------
// Set listing scope
// ---------------------------------------------------------------------------

/**
 * Scryfall `set_type` values that count as a "collectible set" for
 * completion tracking. Excludes promos, tokens, memorabilia, minigames, art
 * series, funny sets, etc. See findings.md "Set completion (F7)" for the
 * rationale — adjustable later if users ask for more set types.
 */
export const ALLOWED_SET_TYPES = [
  "core",
  "expansion",
  "masters",
  "draft_innovation",
  "commander",
  "remastered",
] as const;

// ---------------------------------------------------------------------------
// Collector number ordering
// ---------------------------------------------------------------------------

/**
 * Splits a collector number into a leading numeric run and the rest.
 * "10a" -> { num: 10, rest: "a" }. "★" -> { num: null, rest: "★" } (no
 * leading digits — Scryfall uses symbols for some special printings).
 */
function splitCollectorNumber(value: string): { num: number | null; rest: string } {
  const match = value.match(/^(\d+)(.*)$/);
  if (!match) return { num: null, rest: value };
  return { num: Number(match[1]), rest: match[2] };
}

/**
 * Numeric-aware comparator for Scryfall collector numbers. Plain numbers
 * sort numerically ("2" before "10"); a numeric prefix with an alphabetic
 * suffix sorts right after the plain number ("10" before "10a" before
 * "10b"); collector numbers with no leading digits (symbols like "★") sort
 * after all numeric ones and fall back to plain string comparison among
 * themselves.
 */
export function compareCollectorNumbers(a: string, b: string): number {
  const pa = splitCollectorNumber(a);
  const pb = splitCollectorNumber(b);

  if (pa.num === null && pb.num === null) {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (pa.num === null) return 1;
  if (pb.num === null) return -1;
  if (pa.num !== pb.num) return pa.num - pb.num;
  return pa.rest < pb.rest ? -1 : pa.rest > pb.rest ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export type SetProgress = { total: number; owned: number; pct: number };

/**
 * Owned/total -> clamped integer percentage. Defensive against owned > total
 * (e.g. a stale count from a race) by clamping owned down to total.
 */
export function computeSetProgress({
  total,
  owned,
}: {
  total: number;
  owned: number;
}): SetProgress {
  const safeTotal = Math.max(0, total);
  const clampedOwned = Math.min(Math.max(0, owned), safeTotal);
  const pct = safeTotal === 0 ? 0 : Math.round((clampedOwned / safeTotal) * 100);
  return { total: safeTotal, owned: clampedOwned, pct: Math.min(100, Math.max(0, pct)) };
}

// ---------------------------------------------------------------------------
// Raw SQL row -> view model
// ---------------------------------------------------------------------------

// Shape returned by the $queryRaw aggregation in /sets. Postgres COUNT(*)
// comes back as bigint (mapped to JS `bigint` by pg/Prisma), and the SUM of
// a numeric column comes back as a string.
export type SetSummaryRawRow = {
  setCode: string;
  setName: string;
  setType: string;
  releasedAt: Date | null;
  total: bigint;
  owned: bigint;
  ownedValueUsd: string | null;
};

export type SetSummary = {
  setCode: string;
  setName: string;
  setType: string;
  releasedAt: Date | null;
  total: number;
  owned: number;
  pct: number;
  ownedValueUsd: number;
};

export type SetSortMode = "date" | "progress";

/**
 * Sorts a list of set summaries for /sets. "date" = most recently released
 * first (sets without a releasedAt sort last). "progress" = highest
 * completion percentage first, ties broken by release date desc.
 */
export function sortSetSummaries(sets: SetSummary[], mode: SetSortMode): SetSummary[] {
  const withTime = sets.map((s) => ({ s, t: s.releasedAt ? s.releasedAt.getTime() : -Infinity }));
  withTime.sort((a, b) => {
    if (mode === "progress" && a.s.pct !== b.s.pct) return b.s.pct - a.s.pct;
    return b.t - a.t;
  });
  return withTime.map((w) => w.s);
}

export function mapSetSummaryRow(row: SetSummaryRawRow): SetSummary {
  const { total, owned, pct } = computeSetProgress({
    total: Number(row.total),
    owned: Number(row.owned),
  });
  return {
    setCode: row.setCode,
    setName: row.setName,
    setType: row.setType,
    releasedAt: row.releasedAt,
    total,
    owned,
    pct,
    ownedValueUsd: row.ownedValueUsd != null ? Number(row.ownedValueUsd) : 0,
  };
}
