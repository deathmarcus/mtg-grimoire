"use client";

import type { Currency } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import type { ClientDeckCard } from "./types";

type Props = {
  mainCards: ClientDeckCard[];
  currency: Currency;
  fxRate: number;
};

function getTypeGroup(typeLine: string): string {
  const order = ["Creature","Planeswalker","Instant","Sorcery","Enchantment","Artifact","Land"];
  for (const t of order) {
    if (typeLine.includes(t)) return t;
  }
  return "Other";
}

export function StatsTab({ mainCards, currency, fxRate }: Props) {
  const totalCards = mainCards.reduce((s, c) => s + c.quantity, 0);
  const totalUsd = mainCards.reduce(
    (s, c) => s + (c.card.latestUsd ?? 0) * c.quantity,
    0
  );

  // Avg CMC (non-land cards only)
  const nonLandCards = mainCards.filter((c) => !c.card.typeLine.includes("Land"));
  const totalNonLandQty = nonLandCards.reduce((s, c) => s + c.quantity, 0);
  const totalCmc = nonLandCards.reduce(
    (s, c) => s + c.card.cmc * c.quantity,
    0
  );
  const avgCmc =
    totalNonLandQty > 0
      ? (totalCmc / totalNonLandQty).toFixed(2)
      : "—";

  // Most expensive card
  const mostExpensive = mainCards.reduce(
    (best, c) =>
      (c.card.latestUsd ?? 0) > (best?.card.latestUsd ?? 0) ? c : best,
    null as ClientDeckCard | null
  );

  // Type distribution
  const typeMap: Record<string, number> = {};
  for (const c of mainCards) {
    const t = getTypeGroup(c.card.typeLine);
    typeMap[t] = (typeMap[t] ?? 0) + c.quantity;
  }

  const stats = [
    {
      label: "Total Value",
      value: formatMoney(totalUsd, currency, fxRate),
      color: "var(--accent)",
    },
    {
      label: "Total Cards",
      value: totalCards.toString(),
      color: "var(--ink-0)",
    },
    {
      label: "Avg CMC",
      value: avgCmc,
      color: "var(--ink-0)",
    },
    {
      label: "Most Expensive",
      value: mostExpensive
        ? formatMoney((mostExpensive.card.latestUsd ?? 0), currency, fxRate)
        : "—",
      color: "var(--warn)",
      sub: mostExpensive?.card.name,
    },
    {
      label: "Unique Cards",
      value: mainCards.length.toString(),
      color: "var(--ink-0)",
    },
    {
      label: "Land Count",
      value: (typeMap["Land"] ?? 0).toString(),
      color: "var(--mtg-c)",
    },
  ];

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 16 }}>
        Deck Stats
      </div>

      {mainCards.length === 0 ? (
        <div
          style={{
            padding: "40px 0",
            textAlign: "center",
            color: "var(--ink-3)",
            fontSize: 13,
            fontStyle: "italic",
            fontFamily: "var(--font-display)",
          }}
        >
          Add cards to see stats.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
              marginBottom: 24,
            }}
          >
            {stats.map(({ label, value, color, sub }) => (
              <div key={label} className="panel" style={{ padding: 18 }}>
                <div className="eyebrow">{label}</div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 26,
                    marginTop: 6,
                    color,
                  }}
                >
                  {value}
                </div>
                {sub && (
                  <div
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 9,
                      color: "var(--ink-3)",
                      marginTop: 4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Type distribution */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Type Distribution
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(typeMap)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const pct =
                  totalCards > 0
                    ? Math.round((count / totalCards) * 100)
                    : 0;
                return (
                  <div
                    key={type}
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: 10,
                        color: "var(--ink-2)",
                        width: 80,
                      }}
                    >
                      {type}
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
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: 10,
                        color: "var(--ink-3)",
                        width: 40,
                        textAlign: "right",
                      }}
                    >
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
