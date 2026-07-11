import { t, type Locale } from "./i18n";

export type PriceProvenanceSource = "snapshot" | "catalog";

function formatIsoDate(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Human-readable provenance for a displayed price: where it came from
 * (TCGplayer market data via Scryfall) and how fresh it is — either a
 * weekly CardPrice snapshot date, or the last local catalog sync date.
 */
export function formatPriceProvenance(
  source: PriceProvenanceSource,
  date: Date | string | null,
  locale: Locale,
): string {
  const sourceLabel = t("price.provenance.source", locale);
  const dateStr = formatIsoDate(date);
  if (!dateStr) {
    return `${sourceLabel} · ${t("price.provenance.noDate", locale)}`;
  }
  const key = source === "snapshot" ? "price.provenance.snapshot" : "price.provenance.catalog";
  const suffix = t(key, locale).replace("{date}", dateStr);
  return `${sourceLabel} · ${suffix}`;
}

/**
 * Subtext for MXN-converted prices: the FX rate applied and its snapshot
 * date. Returns null when there's no usable rate (nothing to disclose).
 */
export function formatFxProvenance(
  rate: number | null,
  date: Date | string | null,
  locale: Locale,
): string | null {
  if (rate == null || rate <= 0) return null;
  const dateStr = formatIsoDate(date) ?? t("price.provenance.noDate", locale);
  return t("price.provenance.fx", locale)
    .replace("{rate}", rate.toFixed(2))
    .replace("{date}", dateStr);
}

/** Most recent of a list of possibly-null dates, or null if none are set. */
export function latestDate(dates: (Date | null)[]): Date | null {
  let latest: Date | null = null;
  for (const d of dates) {
    if (d && (!latest || d.getTime() > latest.getTime())) latest = d;
  }
  return latest;
}
