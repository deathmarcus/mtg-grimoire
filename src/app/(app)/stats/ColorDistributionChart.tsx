"use client";

import type { ColorDistributionRow } from "@/lib/stats";
import type { Currency } from "@prisma/client";
import { formatMoney } from "@/lib/money-format";

// Mana color visual config — inline, not in globals.css per spec
const COLOR_CONFIG: Record<string, { label: string; bg: string; pip: string }> =
  {
    W: { label: "White", bg: "var(--mtg-w)", pip: "w" },
    U: { label: "Blue", bg: "var(--mtg-u)", pip: "u" },
    B: { label: "Black", bg: "var(--mtg-b)", pip: "b" },
    R: { label: "Red", bg: "var(--mtg-r)", pip: "r" },
    G: { label: "Green", bg: "var(--mtg-g)", pip: "g" },
    C: { label: "Colorless", bg: "var(--mtg-c)", pip: "c" },
    M: {
      label: "Multicolor",
      bg: "oklch(0.75 0.14 78)",
      pip: "m",
    },
  };

type Props = {
  data: ColorDistributionRow[];
  currency: Currency;
  rate: number;
};

export function ColorDistributionChart({ data, currency, rate }: Props) {
  if (data.length === 0) {
    return (
      <p style={{ color: "var(--ink-2)", fontSize: 13, padding: 18 }}>
        No cards in collection yet.
      </p>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.totalValue), 1);

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((row) => {
        const cfg = COLOR_CONFIG[row.color] ?? {
          label: row.color,
          bg: "var(--ink-3)",
          pip: "",
        };
        const pct = (row.totalValue / maxValue) * 100;

        return (
          <div key={row.color}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              {/* Color indicator dot */}
              <div
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: cfg.bg,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 11,
                  color: "var(--ink-1)",
                  minWidth: 68,
                }}
              >
                {cfg.label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  background: "var(--bg-0)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: cfg.bg,
                    borderRadius: 3,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 11,
                  color: "var(--accent)",
                  minWidth: 72,
                  textAlign: "right",
                }}
              >
                {formatMoney(row.totalValue, currency, rate)}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  minWidth: 40,
                  textAlign: "right",
                }}
              >
                {row.count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
