"use client";

import { PRIMARY_FORMATS } from "@/lib/card-detail";
import type { DeckLegality } from "./types";

type Props = {
  legalityResult: DeckLegality;
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function LegalityTab({ legalityResult }: Props) {
  // Show PRIMARY_FORMATS first, then any extras
  const primarySet = new Set<string>(PRIMARY_FORMATS);
  const extras = Object.keys(legalityResult)
    .filter((f) => !primarySet.has(f))
    .sort();
  const formatOrder = [...PRIMARY_FORMATS.filter((f) => f in legalityResult), ...extras];

  const legalCount = formatOrder.filter((f) => legalityResult[f]).length;

  return (
    <div>
      <div
        className="eyebrow"
        style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}
      >
        <span>Format Legality</span>
        <span style={{ color: "var(--ink-3)" }}>
          {legalCount}/{formatOrder.length} legal
        </span>
      </div>

      {formatOrder.length === 0 ? (
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
          Add cards to check format legality.
        </div>
      ) : (
        <div className="legality-grid">
          {formatOrder.map((format) => {
            const legal = legalityResult[format];
            return (
              <div
                key={format}
                className={`legality-item ${legal ? "is-legal" : "is-banned"}`}
              >
                <div className="legality-format">{capitalize(format)}</div>
                <span className={`chip ${legal ? "pos" : "neg"} legality-status`}>
                  {legal ? "Legal" : "Illegal"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
