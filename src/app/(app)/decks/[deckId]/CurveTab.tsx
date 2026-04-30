"use client";

import type { ClientDeckCard } from "./types";

type Props = {
  manaCurve: number[]; // index 0–6, 6 = "6+"
  colorIdentity: string[];
  mainCards: ClientDeckCard[];
};

const MTG_COLOR_VARS: Record<string, string> = {
  W: "var(--mtg-w)",
  U: "var(--mtg-u)",
  B: "var(--mtg-b)",
  R: "var(--mtg-r)",
  G: "var(--mtg-g)",
  C: "var(--mtg-c)",
};

const TYPE_COLORS: Record<string, string> = {
  Creature: "var(--mtg-g)",
  Planeswalker: "var(--accent)",
  Instant: "var(--mtg-u)",
  Sorcery: "var(--mtg-r)",
  Enchantment: "var(--mtg-w)",
  Artifact: "var(--ink-2)",
  Land: "var(--mtg-c)",
  Other: "var(--ink-3)",
};

function getTypeGroup(typeLine: string): string {
  const order = ["Creature","Planeswalker","Instant","Sorcery","Enchantment","Artifact","Land"];
  for (const t of order) {
    if (typeLine.includes(t)) return t;
  }
  return "Other";
}

export function CurveTab({ manaCurve, colorIdentity, mainCards }: Props) {
  const maxCurveVal = Math.max(...manaCurve, 1);

  // Type distribution
  const typeMap: Record<string, number> = {};
  let totalNonEmpty = 0;
  for (const c of mainCards) {
    const t = getTypeGroup(c.card.typeLine);
    typeMap[t] = (typeMap[t] ?? 0) + c.quantity;
    totalNonEmpty += c.quantity;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
      {/* Mana curve */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Mana Curve
        </div>
        <div
          style={{
            height: 220,
            background: "var(--bg-0)",
            padding: "20px 16px 0",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--line-soft)",
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
          }}
        >
          {manaCurve.map((v, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                height: "100%",
                justifyContent: "flex-end",
              }}
            >
              {v > 0 && (
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 10,
                    color: "var(--ink-2)",
                    marginBottom: 2,
                  }}
                >
                  {v}
                </div>
              )}
              <div
                style={{
                  width: "100%",
                  height: `${(v / maxCurveVal) * 160}px`,
                  background: "linear-gradient(180deg, var(--accent), var(--mtg-r))",
                  borderRadius: "3px 3px 0 0",
                  minHeight: v > 0 ? 4 : 2,
                  opacity: v > 0 ? 1 : 0.15,
                }}
              />
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 10,
                  color: "var(--ink-1)",
                  paddingBottom: 6,
                }}
              >
                {i}
                {i === 6 ? "+" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right column: color sources + type distribution */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Color Identity
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {colorIdentity.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Colorless</div>
          ) : (
            colorIdentity.map((c) => {
              // Count mana symbols of this color in mana costs
              const colorLower = c.toLowerCase();
              let count = 0;
              for (const card of mainCards) {
                const matches = card.card.manaCost.match(
                  new RegExp(`\\{${c}\\}`, "gi")
                );
                if (matches) count += matches.length * card.quantity;
              }
              const total = mainCards.reduce((s, card) => {
                const symbols = (card.card.manaCost.match(/\{[A-Z0-9]+\}/g) ?? []).length;
                return s + symbols * card.quantity;
              }, 1);
              const pct = Math.round((count / total) * 100);
              return (
                <div
                  key={c}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <i className={`ms ms-${colorLower} ms-cost ms-shadow`} aria-hidden="true" />
                  <div
                    style={{
                      flex: 1,
                      height: 8,
                      background: "var(--bg-0)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(pct, 5)}%`,
                        background: MTG_COLOR_VARS[c] ?? "var(--ink-2)",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 10,
                      color: "var(--ink-2)",
                      width: 30,
                      textAlign: "right",
                    }}
                  >
                    {count}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Type Distribution
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(typeMap)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count]) => {
              const pct = totalNonEmpty > 0 ? Math.round((count / totalNonEmpty) * 100) : 0;
              return (
                <div key={type}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 10,
                      color: "var(--ink-2)",
                    }}
                  >
                    <span>{type}</span>
                    <span>{pct}%</span>
                  </div>
                  <div
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
                        width: `${pct}%`,
                        background: TYPE_COLORS[type] ?? "var(--ink-3)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
