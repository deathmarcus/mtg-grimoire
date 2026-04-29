import type { Currency } from "@prisma/client";

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const MXN_FMT = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

export function formatMoney(
  usdAmount: number | null | undefined,
  currency: Currency,
  rate: number,
): string {
  if (usdAmount == null) return "—";
  if (currency === "USD") return `${USD_FMT.format(usdAmount)} USD`;
  return `${MXN_FMT.format(usdAmount * (rate || 0))} MXN`;
}

export function toNumber(decimal: unknown): number | null {
  if (decimal == null) return null;
  const n = Number(decimal);
  return Number.isFinite(n) ? n : null;
}
