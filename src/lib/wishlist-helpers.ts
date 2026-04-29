export function computeGap(
  currentUsd: number | null,
  maxPriceUsd: number | null,
): number | null {
  if (currentUsd == null || maxPriceUsd == null) return null;
  return currentUsd - maxPriceUsd;
}

export type TargetStatus = "reached" | "close" | "far";

export function targetPriceProgress(
  currentUsd: number | null,
  maxPriceUsd: number | null,
): { percent: number; status: TargetStatus } | null {
  if (currentUsd == null || maxPriceUsd == null || maxPriceUsd <= 0) return null;
  if (currentUsd <= maxPriceUsd) return { percent: 100, status: "reached" };
  const percent = Math.max(0, Math.min(100, (maxPriceUsd / currentUsd) * 100));
  const gap = currentUsd - maxPriceUsd;
  const status: TargetStatus = gap < maxPriceUsd * 0.2 ? "close" : "far";
  return { percent, status };
}
