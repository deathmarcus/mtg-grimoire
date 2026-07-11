"use client";

import { useState, useMemo } from "react";
import { Sparkline } from "@/components/Sparkline";
import {
  filterValueHistoryByRange,
  valueHistoryState,
  type Range,
  type ValueHistoryPoint,
} from "@/lib/dashboard";
import { formatMoney } from "@/lib/money-format";
import { t, type Locale } from "@/lib/i18n";
import type { Currency } from "@prisma/client";

const RANGES: Range[] = ["1m", "3m", "6m", "1y", "all"];
const RANGE_LABELS: Record<Range, string> = {
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
  defaultRange?: Range;
  locale: Locale;
  provenanceText?: string;
  fxText?: string | null;
};

export function ValueChart({
  history,
  currency,
  rate,
  defaultRange = "1y",
  locale,
  provenanceText,
  fxText,
}: Props) {
  const [range, setRange] = useState<Range>(defaultRange);

  const filtered = useMemo(
    () => filterValueHistoryByRange(history, range),
    [history, range],
  );

  const latestValue = filtered.length > 0
    ? filtered[filtered.length - 1].value
    : 0;

  const values = filtered.map((p) => p.value);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">Valor de colección</div>
          <div className="panel-title" style={{ marginTop: 4 }}>
            {formatMoney(latestValue, currency, rate)}
          </div>
          {provenanceText && (
            <div
              className="mono"
              style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 4 }}
              title={fxText ?? undefined}
            >
              {provenanceText}
              {fxText ? ` · ${fxText}` : ""}
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
      <div style={{ padding: 20, height: 220 }}>
        {valueHistoryState(values.length) !== "ready" ? (
          <p
            style={{
              color: "var(--ink-2)",
              fontSize: 13,
              textAlign: "center",
              paddingTop: 80,
            }}
          >
            {values.length === 1
              ? t("chart.value.building", locale)
              : t("chart.value.empty", locale)}
          </p>
        ) : (
          <Sparkline
            values={values}
            ariaLabel={`Valor de colección, ${filtered.length} snapshots`}
            width={800}
            height={180}
          />
        )}
      </div>
    </div>
  );
}
