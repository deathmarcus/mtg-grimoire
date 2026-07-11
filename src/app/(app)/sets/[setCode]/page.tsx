import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/session";
import { getLatestFxRate } from "@/lib/money";
import { formatMoney, toNumber } from "@/lib/money-format";
import { compareCollectorNumbers, computeSetProgress } from "@/lib/sets";
import { SetProgressBar } from "@/components/SetProgressBar";
import { RarityDot } from "@/components/RarityDot";
import { CardHoverPreview } from "@/components/CardHoverPreview";
import { t, type Locale } from "@/lib/i18n";

type SetCardRow = {
  id: string;
  name: string;
  setName: string;
  collectorNumber: string;
  rarity: string;
  latestUsd: Prisma.Decimal | null;
  imageSmall: string | null;
  imageNormal: string | null;
  ownedQty: number;
};

type Params = Promise<{ setCode: string }>;
type SearchParams = Promise<{ missing?: string }>;

export default async function SetDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { setCode } = await params;
  const { missing } = await searchParams;
  const missingOnly = missing === "1";

  const [dbUser, fx] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayCurrency: true, locale: true },
    }),
    getLatestFxRate(),
  ]);
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  const rows = await prisma.$queryRaw<SetCardRow[]>(Prisma.sql`
    SELECT
      c.id, c.name, c."setName", c."collectorNumber", c.rarity,
      c."latestUsd", c."imageSmall", c."imageNormal",
      COALESCE(qty."ownedQty", 0)::int AS "ownedQty"
    FROM "Card" c
    LEFT JOIN LATERAL (
      SELECT SUM(ci.quantity) AS "ownedQty"
      FROM "CollectionItem" ci
      WHERE ci."cardId" = c.id AND ci."userId" = ${user.id}
    ) qty ON true
    WHERE c."setCode" = ${setCode.toLowerCase()}
      AND c.promo = false AND c.variation = false AND c.lang = 'en'
  `);

  if (rows.length === 0) notFound();

  const sorted = [...rows].sort((a, b) =>
    compareCollectorNumbers(a.collectorNumber, b.collectorNumber),
  );

  const total = sorted.length;
  const ownedCount = sorted.filter((r) => r.ownedQty > 0).length;
  const progress = computeSetProgress({ total, owned: ownedCount });
  const setName = sorted[0].setName;

  const visible = missingOnly ? sorted.filter((r) => r.ownedQty === 0) : sorted;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <Link
          href="/sets"
          className="mono"
          style={{ fontSize: 11, color: "var(--ink-3)", textDecoration: "none" }}
        >
          {t("page.setDetail.back", locale)}
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>{setCode.toUpperCase()}</div>
            <h1
              style={{
                fontFamily: "var(--font-crimson-pro), Georgia, serif",
                fontSize: 24,
                fontWeight: 500,
              }}
            >
              {setName}
            </h1>
          </div>
          <div style={{ width: 260 }}>
            <SetProgressBar owned={progress.owned} total={progress.total} pct={progress.pct} />
          </div>
        </div>
      </div>

      <div>
        <div role="group" aria-label="Filter" className="toggle-group">
          <Link
            href={`/sets/${setCode}`}
            aria-pressed={!missingOnly}
            className={!missingOnly ? "active" : ""}
          >
            {t("page.setDetail.showAll", locale)}
          </Link>
          <Link
            href={{ pathname: `/sets/${setCode}`, query: { missing: "1" } }}
            aria-pressed={missingOnly}
            className={missingOnly ? "active" : ""}
          >
            {t("page.setDetail.missingOnly", locale)}
          </Link>
        </div>
      </div>

      <div className="panel" style={{ overflow: "hidden", padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 48 }} />
              <th className="mono num" style={{ width: 60 }}>#</th>
              <th>Card</th>
              <th className="num">{t("label.price", locale)}</th>
              <th className="num" style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const owned = c.ownedQty > 0;
              const price = toNumber(c.latestUsd);
              const href = owned
                ? `/collection?q=${encodeURIComponent(c.name)}`
                : `/collection/new?pick=${c.id}`;
              return (
                <tr key={c.id} style={{ opacity: owned ? 1 : 0.55 }}>
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
                      {c.imageSmall && (
                        <Image
                          src={c.imageSmall}
                          alt={c.name}
                          width={40}
                          height={56}
                          style={{ objectFit: "cover", width: "100%", height: "100%" }}
                          unoptimized
                        />
                      )}
                    </div>
                  </td>
                  <td className="mono num" style={{ color: "var(--ink-3)" }}>
                    {c.collectorNumber}
                  </td>
                  <td>
                    <CardHoverPreview imageUrl={c.imageNormal} cardName={c.name}>
                      <Link
                        href={href}
                        style={{
                          fontFamily: "var(--font-crimson-pro), Georgia, serif",
                          fontSize: 14,
                          color: "var(--ink-0)",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <RarityDot rarity={c.rarity} />
                        {c.name}
                      </Link>
                    </CardHoverPreview>
                  </td>
                  <td className="num">{price != null ? formatMoney(price, currency, fx.rate) : "—"}</td>
                  <td className="num">
                    {owned ? (
                      <span className="chip pos">
                        {t("page.setDetail.owned", locale)} × {c.ownedQty}
                      </span>
                    ) : (
                      <span className="chip" style={{ color: "var(--ink-3)" }}>
                        {t("page.setDetail.missing", locale)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
