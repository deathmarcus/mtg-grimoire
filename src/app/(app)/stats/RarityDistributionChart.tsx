import type { RarityDistributionRow } from "@/lib/stats";
import { RarityDot } from "@/components/RarityDot";

type Props = {
  data: RarityDistributionRow[];
};

export function RarityDistributionChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p style={{ color: "var(--ink-2)", fontSize: 13, padding: 18 }}>
        No cards in collection yet.
      </p>
    );
  }

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      {data.map((row) => (
        <div key={row.rarity}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
              fontSize: 12,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                textTransform: "capitalize",
                color: "var(--ink-1)",
              }}
            >
              <RarityDot rarity={row.rarity} />
              {row.rarity}
            </span>
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 11,
                color: "var(--ink-2)",
              }}
            >
              {row.count} ({row.pct.toFixed(0)}%)
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: "var(--bg-0)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${row.pct}%`,
                background: rarityColor(row.rarity),
                borderRadius: 3,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function rarityColor(rarity: string): string {
  switch (rarity) {
    case "mythic":
      return "var(--r-mythic)";
    case "rare":
      return "var(--r-rare)";
    case "uncommon":
      return "var(--r-uncommon)";
    case "common":
    default:
      return "var(--r-common)";
  }
}
