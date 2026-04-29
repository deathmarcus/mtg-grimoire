"use client";

import { useState, useMemo } from "react";
import { Sparkline } from "@/components/Sparkline";
import {
  filterValueHistoryByRange,
  type Range,
  type ValueHistoryPoint,
} from "@/lib/dashboard";
import { formatMoney } from "@/lib/money-format";
import type { Currency } from "@prisma/client";

// Stats page uses a wider range set than the dashboard (adds 1W)
type StatsRange = "1m" | "3m" | "6m" | "1y" | "all";

const RANGES: StatsRange[] = ["1m", "3m", "6m", "1y", "all"];
const RANGE_LABELS: Record<StatsRange, string> = {
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  all: "All",
};

type Props = {
  history: ValueHistoryPoint[];
  currency: Currency;
  rate: number;
};

export function ValueHistoryChart({ history, currency, rate }: Props) {
  const [range, setRange] = useState<StatsRange>("1y");

  const filtered = useMemo(
    () => filterValueHistoryByRange(history, range as Range),
    [history, range],
  );

  const latestValue =
    filtered.length > 0 ? filtered[filtered.length - 1].value : 0;
  const firstValue = filtered.length > 0 ? filtered[0].value : 0;

  // Compute YoY-style change for the selected range
  const changePct =
    firstValue > 0 ? ((latestValue - firstValue) / firstValue) * 100 : null;

  const values = filtered.map((p) => p.value);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">Valor de colección</div>
          <div
            style={{
              fontFamily: "var(--font-crimson-pro), Georgia, serif",
              fontSize: 36,
              fontWeight: 500,
              color: "var(--accent)",
              marginTop: 4,
              lineHeight: 1,
            }}
          >
            {formatMoney(latestValue, currency, rate)}
          </div>
          {changePct != null && (
            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 6,
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 11,
              }}
            >
              <span
                className={`chip ${changePct >= 0 ? "pos" : "neg"}`}
              >
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(1)}%
              </span>
              <span style={{ color: "var(--ink-3)" }}>
                since start of range
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`btn btn-sm ${r === range ? "btn-primary" : ""}`}
              aria-pressed={r === range}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: 20, height: 280 }}>
        {values.length === 0 ? (
          <p
            style={{
              color: "var(--ink-2)",
              fontSize: 13,
              textAlign: "center",
              paddingTop: 100,
            }}
          >
            Sin snapshots en este rango. Corre{" "}
            <code>npm run sync:weekly</code> para empezar a llenar el
            histórico.
          </p>
        ) : (
          <Sparkline
            values={values}
            ariaLabel={`Valor de colección, ${filtered.length} snapshots`}
            width={900}
            height={240}
          />
        )}
      </div>
    </div>
  );
}
