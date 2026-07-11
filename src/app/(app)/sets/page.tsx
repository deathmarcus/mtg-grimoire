import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { getLatestFxRate } from "@/lib/money";
import { formatMoney } from "@/lib/money-format";
import {
  ALLOWED_SET_TYPES,
  mapSetSummaryRow,
  sortSetSummaries,
  type SetSortMode,
  type SetSummaryRawRow,
} from "@/lib/sets";
import { SetProgressBar } from "@/components/SetProgressBar";
import { t, type Locale } from "@/lib/i18n";

export const metadata = { title: "Sets — Grimoire" };

type SearchParams = Promise<{ sort?: string }>;

export default async function SetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { sort } = await searchParams;
  const sortMode: SetSortMode = sort === "progress" ? "progress" : "date";

  const [dbUser, fx] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayCurrency: true, locale: true },
    }),
    getLatestFxRate(),
  ]);
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  // Single aggregation query — one pass over the catalog, no N+1. See
  // findings.md "Set completion (F7)" for the counting decision and
  // EXPLAIN ANALYZE evidence.
  const rows = await prisma.$queryRaw<SetSummaryRawRow[]>(Prisma.sql`
    SELECT
      c."setCode"    AS "setCode",
      MAX(c."setName")    AS "setName",
      MAX(c."setType")    AS "setType",
      MAX(c."releasedAt") AS "releasedAt",
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE owned_flag.owned) AS owned,
      COALESCE(SUM(CASE WHEN owned_flag.owned THEN c."latestUsd" ELSE 0 END), 0) AS "ownedValueUsd"
    FROM "Card" c
    CROSS JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1 FROM "CollectionItem" ci
        WHERE ci."cardId" = c.id AND ci."userId" = ${user.id}
      ) AS owned
    ) owned_flag
    WHERE c.promo = false AND c.variation = false AND c.lang = 'en'
      AND c."setType" = ANY(${ALLOWED_SET_TYPES}::text[])
    GROUP BY c."setCode"
  `);

  const sets = sortSetSummaries(rows.map(mapSetSummaryRow), sortMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{t("page.sets.subtitle", locale)}</div>
          <h1
            style={{
              fontFamily: "var(--font-crimson-pro), Georgia, serif",
              fontSize: 24,
              fontWeight: 500,
            }}
          >
            {t("page.sets.title", locale)}
          </h1>
        </div>

        <div role="group" aria-label="Sort sets" className="toggle-group">
          <Link
            href={{ pathname: "/sets", query: { sort: "date" } }}
            aria-pressed={sortMode === "date"}
            className={sortMode === "date" ? "active" : ""}
          >
            {t("page.sets.sortDate", locale)}
          </Link>
          <Link
            href={{ pathname: "/sets", query: { sort: "progress" } }}
            aria-pressed={sortMode === "progress"}
            className={sortMode === "progress" ? "active" : ""}
          >
            {t("page.sets.sortProgress", locale)}
          </Link>
        </div>
      </div>

      {sets.length === 0 ? (
        <div className="panel panel-body">
          <p style={{ color: "var(--ink-2)", fontSize: 13 }}>{t("page.sets.empty", locale)}</p>
        </div>
      ) : (
        <div className="panel" style={{ overflow: "hidden", padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>{t("page.sets.colSet", locale)}</th>
                <th>{t("page.sets.colType", locale)}</th>
                <th>{t("page.sets.colReleased", locale)}</th>
                <th style={{ width: 220 }}>{t("page.sets.colProgress", locale)}</th>
                <th className="num">{t("page.sets.colValue", locale)}</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => (
                <tr key={s.setCode}>
                  <td>
                    <Link
                      href={`/sets/${s.setCode}`}
                      style={{
                        fontFamily: "var(--font-crimson-pro), Georgia, serif",
                        fontSize: 14,
                        color: "var(--ink-0)",
                        textDecoration: "none",
                      }}
                    >
                      {s.setName}
                    </Link>
                    <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                      {s.setCode.toUpperCase()}
                    </div>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                      {s.setType}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                      {s.releasedAt ? s.releasedAt.toISOString().slice(0, 10) : "—"}
                    </span>
                  </td>
                  <td>
                    <SetProgressBar owned={s.owned} total={s.total} pct={s.pct} />
                  </td>
                  <td className="num" style={{ color: "var(--accent)" }}>
                    {formatMoney(s.ownedValueUsd, currency, fx.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
