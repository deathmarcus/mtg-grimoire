import { targetPriceProgress } from "@/lib/wishlist-helpers";

export function TargetPriceBar({
  currentUsd,
  maxPriceUsd,
}: {
  currentUsd: number | null;
  maxPriceUsd: number | null;
}) {
  const r = targetPriceProgress(currentUsd, maxPriceUsd);
  if (!r) return null;
  const color = r.status === "reached" || r.status === "close" ? "var(--pos)" : "var(--accent)";
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(r.percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Target price progress: ${r.status}`}
      style={{
        height: 4,
        background: "var(--bg-0)",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${r.percent}%`,
          background: color,
          transition: "width 200ms",
        }}
      />
    </div>
  );
}
