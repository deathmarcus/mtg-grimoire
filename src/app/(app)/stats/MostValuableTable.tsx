import Image from "next/image";
import Link from "next/link";
import { RarityDot } from "@/components/RarityDot";
import { Sparkline } from "@/components/Sparkline";
import { formatMoney } from "@/lib/money-format";
import type { Currency } from "@prisma/client";

export type MostValuableRow = {
  id: string; // CollectionItem id
  cardId: string;
  name: string;
  setCode: string;
  rarity: string;
  quantity: number;
  latestUsd: number | null;
  imageSmall: string | null;
  foil: string;
  priceHistory: number[]; // last 6 snapshots ascending
};

type Props = {
  items: MostValuableRow[];
  currency: Currency;
  rate: number;
};

export function MostValuableTable({ items, currency, rate }: Props) {
  if (items.length === 0) {
    return (
      <div className="panel-body">
        <p style={{ color: "var(--ink-2)", fontSize: 13 }}>
          No cards in collection yet.
        </p>
      </div>
    );
  }

  return (
    <table className="tbl">
      <thead>
        <tr>
          <th style={{ width: 48 }} />
          <th>Card</th>
          <th>Set</th>
          <th className="num">Qty</th>
          <th className="num">Unit</th>
          <th className="num">Total</th>
          <th className="num" style={{ width: 88 }}>
            12m
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => {
          const unitUsd = row.latestUsd;
          const totalUsd = unitUsd != null ? unitUsd * row.quantity : null;

          return (
            <tr key={row.id}>
              {/* Thumbnail */}
              <td>
                <div
                  style={{
                    width: 40,
                    height: 56,
                    borderRadius: "var(--r-sm)",
                    overflow: "hidden",
                    background: "var(--bg-0)",
                  }}
                >
                  {row.imageSmall ? (
                    <Image
                      src={row.imageSmall}
                      alt={row.name}
                      width={40}
                      height={56}
                      style={{ objectFit: "cover", width: "100%", height: "100%" }}
                      unoptimized
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--ink-3)",
                        fontSize: 10,
                      }}
                    >
                      —
                    </div>
                  )}
                </div>
              </td>

              {/* Card name — link to detail */}
              <td>
                <Link
                  href={`/collection/${row.id}`}
                  style={{
                    fontFamily: "var(--font-crimson-pro), Georgia, serif",
                    fontSize: 14,
                    color: "var(--ink-0)",
                    textDecoration: "none",
                  }}
                >
                  {row.name}
                </Link>
                {row.foil !== "NORMAL" && (
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 9,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      color: "var(--accent)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {row.foil.toLowerCase()}
                  </span>
                )}
              </td>

              {/* Set */}
              <td>
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 11,
                    color: "var(--ink-3)",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <RarityDot rarity={row.rarity} />
                  {row.setCode.toUpperCase()}
                </span>
              </td>

              {/* Qty */}
              <td className="num">{row.quantity}</td>

              {/* Unit price */}
              <td className="num">
                {unitUsd != null
                  ? formatMoney(unitUsd, currency, rate)
                  : "—"}
              </td>

              {/* Total value */}
              <td
                className="num"
                style={{ color: "var(--accent)" }}
              >
                {totalUsd != null
                  ? formatMoney(totalUsd, currency, rate)
                  : "—"}
              </td>

              {/* Mini sparkline */}
              <td style={{ width: 88 }}>
                {row.priceHistory.length > 1 ? (
                  <div style={{ height: 24, width: 80 }}>
                    <Sparkline
                      values={row.priceHistory}
                      ariaLabel={`Price history for ${row.name}`}
                      width={80}
                      height={24}
                    />
                  </div>
                ) : (
                  <span
                    style={{
                      color: "var(--ink-3)",
                      fontSize: 10,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                    }}
                  >
                    —
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
