import Link from "next/link";
import type { Currency } from "@prisma/client";
import { formatMoney } from "@/lib/money-format";
import { pickPriceForFinish } from "@/lib/pricing";

export type EditionRow = {
  id: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  releasedYear: string | null;
  latestUsd: unknown;
  latestUsdFoil: unknown;
  latestUsdEtched: unknown;
};

type Props = {
  editions: EditionRow[];
  currency: Currency;
  rate: number;
};

export function EditionsTab({ editions, currency, rate }: Props) {
  if (editions.length === 0) {
    return (
      <div className="panel">
        <div className="panel-body">
          <p style={{ color: "var(--ink-2)", fontSize: 13 }}>
            No other printings of this card in the local catalog. Run{" "}
            <code>npm run sync:catalog</code> to refresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ overflow: "hidden" }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Set</th>
            <th>Year</th>
            <th>Rarity</th>
            <th className="num">USD</th>
            <th className="num">Foil USD</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {editions.map((e) => {
            const card = {
              latestUsd: e.latestUsd,
              latestUsdFoil: e.latestUsdFoil,
              latestUsdEtched: e.latestUsdEtched,
            };
            const usd = pickPriceForFinish(card, "NORMAL");
            const foil = pickPriceForFinish(card, "FOIL");
            return (
              <tr key={e.id}>
                <td>
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "var(--ink-1)",
                    }}
                  >
                    {e.setCode}
                  </span>{" "}
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--ink-2)",
                    }}
                  >
                    {e.setName} #{e.collectorNumber}
                  </span>
                </td>
                <td className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>
                  {e.releasedYear ?? "—"}
                </td>
                <td>
                  <span className="chip" style={{ textTransform: "capitalize" }}>
                    {e.rarity}
                  </span>
                </td>
                <td className="num">
                  {usd != null ? formatMoney(usd, currency, rate) : "—"}
                </td>
                <td className="num">
                  {foil != null ? formatMoney(foil, currency, rate) : "—"}
                </td>
                <td>
                  <Link
                    href={`/collection/new?pick=${e.id}`}
                    className="btn btn-sm"
                  >
                    Add
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
