import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestUsdToMxn } from "@/lib/money";
import {
  aggregateCollectionValue,
  pickPriceForFinish,
} from "@/lib/pricing";
import {
  aggregateValueByDate,
  computePriceChangePct,
  pickTopMovers,
  toNumber,
  type SnapshotRow,
  type TopMoverInput,
  type ValuedItem,
} from "@/lib/dashboard";
import { getRecentActivity } from "@/lib/activity";
import { Sparkline } from "@/components/Sparkline";
import { IconArrow } from "@/components/Icons";
import { ValueChart } from "./ValueChart";
import { ActivityFeed } from "./ActivityFeed";
import { t, type Locale } from "@/lib/i18n";

export default async function DashboardPage() {
  const user = await requireUser();

  const [items, rate, dbUser, snapshots, recentlyAdded, activity] = await Promise.all([
    prisma.collectionItem.findMany({
      where: { userId: user.id },
      include: { card: true, collection: true },
    }),
    getLatestUsdToMxn(),
    prisma.user.findUnique({ where: { id: user.id }, select: { displayCurrency: true, locale: true } }),
    fetchOwnedSnapshots(user.id),
    prisma.collectionItem.findMany({
      where: { userId: user.id, collection: { excludeFromTotals: false } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { card: true },
    }),
    getRecentActivity(user.id, 8),
  ]);

  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  const aggregateItems = items.map((it) => ({
    cardId: it.cardId,
    quantity: it.quantity,
    foil: it.foil,
    excluded: it.collection.excludeFromTotals,
    card: it.card,
  }));
  const { included, excluded, totalCards, uniquePrintings } =
    aggregateCollectionValue(aggregateItems);
  const hasExcluded = excluded.totalCards > 0;

  // Value over time history (only included items count toward the chart)
  const valuedItems: ValuedItem[] = items.map((it) => ({
    cardId: it.cardId,
    quantity: it.quantity,
    foil: it.foil,
    excluded: it.collection.excludeFromTotals,
  }));
  const valueHistory = aggregateValueByDate(valuedItems, snapshots);
  const valueSparkValues = valueHistory.slice(-12).map((p) => p.value);

  // Top movers: per cardId, latestUsd vs previous snapshot
  const topMovers = computeTopMovers(items, snapshots);

  // Top 5 most valuable (excluding excluded folders)
  const topFive = items
    .filter((it) => !it.collection.excludeFromTotals)
    .map((it) => {
      const price = pickPriceForFinish(it.card, it.foil);
      return { it, value: (price ?? 0) * it.quantity };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Stat tiles */}
      <div className="stat-grid">
        <div className="stat" style={{ position: "relative" }}>
          <div className="stat-label">
            {hasExcluded ? t("page.dashboard.myCollection", locale) : t("page.dashboard.totalValue", locale)}
          </div>
          <div className="stat-value">
            {formatMoney(included.totalUsd, currency, rate)}
          </div>
          <div className="stat-sub">
            {uniquePrintings.toLocaleString()} {t("page.dashboard.unique", locale).toLowerCase()}
          </div>
          {valueSparkValues.length > 1 && (
            <div className="spark">
              <Sparkline
                values={valueSparkValues}
                ariaLabel={`Tendencia del valor (${valueSparkValues.length} snapshots)`}
                width={240}
                height={30}
              />
            </div>
          )}
        </div>

        {hasExcluded && (
          <div className="stat">
            <div className="stat-label">{t("page.dashboard.forSale", locale)}</div>
            <div className="stat-value">
              {formatMoney(excluded.totalUsd, currency, rate)}
            </div>
            <div className="stat-sub">
              {excluded.totalCards.toLocaleString()} cards
            </div>
          </div>
        )}

        <div className="stat">
          <div className="stat-label">{t("page.dashboard.cards", locale)}</div>
          <div className="stat-value">{totalCards.toLocaleString()}</div>
          <div className="stat-sub">
            {uniquePrintings.toLocaleString()} {t("page.dashboard.unique", locale).toLowerCase()}
          </div>
        </div>

        <div className="stat">
          <div className="stat-label">{t("page.dashboard.unique", locale)}</div>
          <div className="stat-value">
            {uniquePrintings.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Value over time + Recent activity (2:1 grid) */}
      <div
        className="dashboard-row"
        style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}
      >
        <ValueChart history={valueHistory} currency={currency} rate={rate} />
        <ActivityFeed entries={activity} />
      </div>

      {/* Top movers + Most valuable */}
      <div
        className="dashboard-row"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
      >
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">{t("page.dashboard.topMovers", locale)}</div>
            {topMovers.length > 0 && (
              <span
                aria-hidden="true"
                style={{
                  color: "var(--ink-3)",
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 10,
                }}
              >
                vs prev snapshot
              </span>
            )}
          </div>
          {topMovers.length === 0 ? (
            <div className="panel-body">
              <p style={{ color: "var(--ink-2)", fontSize: 13 }}>
                Necesitamos al menos 2 snapshots para detectar movimientos.
                Corre <code>npm run sync:weekly</code> para acumular histórico.
              </p>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Set</th>
                  <th className="num">Price</th>
                  <th className="num">Δ</th>
                </tr>
              </thead>
              <tbody>
                {topMovers.map((m) => (
                  <tr key={m.cardId}>
                    <td
                      style={{
                        fontFamily: "var(--font-crimson-pro), serif",
                        fontSize: 14,
                      }}
                    >
                      {m.name}
                    </td>
                    <td>
                      <span
                        className="mono"
                        style={{
                          color: "var(--ink-3)",
                          fontSize: 11,
                          textTransform: "uppercase",
                        }}
                      >
                        {m.setCode}
                      </span>
                    </td>
                    <td className="num">
                      {formatMoney(m.latestUsd, currency, rate)}
                    </td>
                    <td className="num">
                      <span
                        className={`chip ${
                          (m.changePct ?? 0) > 0
                            ? "pos"
                            : (m.changePct ?? 0) < 0
                              ? "neg"
                              : ""
                        }`}
                      >
                        {m.changePct == null
                          ? "—"
                          : `${m.changePct > 0 ? "+" : ""}${m.changePct.toFixed(1)}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">{t("page.dashboard.topCards", locale)}</div>
            <Link href="/collection" className="btn btn-ghost btn-sm">
              View all <IconArrow size={12} />
            </Link>
          </div>
          {topFive.length === 0 ? (
            <div className="panel-body">
              <EmptyState />
            </div>
          ) : (
            <div className="panel-body">
              <ol
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {topFive.map(({ it, value }, idx) => (
                  <li key={it.id}>
                    <Link
                      href={`/collection/${it.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 8,
                        borderRadius: "var(--r-md)",
                        background: "var(--bg-0)",
                        border: "1px solid var(--line-soft)",
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          color: "var(--ink-3)",
                          fontFamily:
                            "var(--font-jetbrains-mono), monospace",
                          fontSize: 11,
                          width: 20,
                          textAlign: "right",
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div
                        style={{
                          width: 36,
                          height: 50,
                          overflow: "hidden",
                          borderRadius: 4,
                          background: "var(--bg-2)",
                          flexShrink: 0,
                        }}
                      >
                        {it.card.imageSmall && (
                          <Image
                            src={it.card.imageSmall}
                            alt=""
                            width={36}
                            height={50}
                            unoptimized
                          />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "var(--font-crimson-pro), serif",
                            fontSize: 14,
                            color: "var(--ink-0)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {it.card.name}
                        </div>
                        <div
                          style={{
                            color: "var(--ink-3)",
                            fontFamily:
                              "var(--font-jetbrains-mono), monospace",
                            fontSize: 10,
                            textTransform: "uppercase",
                          }}
                        >
                          {it.card.setCode} · ×{it.quantity}
                        </div>
                      </div>
                      <span
                        style={{
                          fontFamily:
                            "var(--font-jetbrains-mono), monospace",
                          fontSize: 13,
                          color: "var(--accent)",
                        }}
                      >
                        {formatMoney(value, currency, rate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {/* Recently added grid */}
      {recentlyAdded.length > 0 && (
        <>
          <div className="divider">
            <span className="divider-text">{t("page.dashboard.recentlyAdded", locale)}</span>
          </div>
          <div
            className="coll-grid"
            style={{ gridTemplateColumns: "repeat(6, 1fr)" }}
          >
            {recentlyAdded.map((it) => (
              <Link
                key={it.id}
                href={`/collection/${it.id}`}
                className="coll-card"
                aria-label={`${it.card.name}, ${it.quantity} copies`}
              >
                <div className="card-art">
                  {it.card.imageNormal ? (
                    <Image
                      src={it.card.imageNormal}
                      alt=""
                      width={244}
                      height={340}
                      unoptimized
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "var(--bg-2)",
                      }}
                    />
                  )}
                </div>
                {it.quantity > 1 && (
                  <div className="coll-card-qty">×{it.quantity}</div>
                )}
                <div className="coll-card-meta">
                  <div className="coll-card-name">{it.card.name}</div>
                  <div className="coll-card-price">
                    {it.card.setCode.toUpperCase()} ·{" "}
                    {formatMoney(
                      pickPriceForFinish(it.card, it.foil) ?? 0,
                      currency,
                      rate,
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

async function fetchOwnedSnapshots(userId: string): Promise<SnapshotRow[]> {
  // Pull last ~12 months of snapshots for cards the user owns.
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const ownedCardIds = await prisma.collectionItem.findMany({
    where: { userId },
    select: { cardId: true },
    distinct: ["cardId"],
  });
  const ids = ownedCardIds.map((r) => r.cardId);
  if (ids.length === 0) return [];

  const rows = await prisma.cardPrice.findMany({
    where: { cardId: { in: ids }, snapshotDate: { gte: cutoff } },
    select: {
      cardId: true,
      snapshotDate: true,
      priceUsd: true,
      priceUsdFoil: true,
      priceUsdEtched: true,
    },
    orderBy: { snapshotDate: "asc" },
  });
  return rows;
}

function computeTopMovers(
  items: Array<{
    cardId: string;
    foil: import("@prisma/client").FoilKind;
    card: { name: string; setCode: string };
  }>,
  snapshots: SnapshotRow[],
): TopMoverInput[] {
  if (items.length === 0 || snapshots.length === 0) return [];

  // Group snapshots by cardId, sorted ascending by date.
  const byCard = new Map<string, SnapshotRow[]>();
  for (const s of snapshots) {
    const list = byCard.get(s.cardId) ?? [];
    list.push(s);
    byCard.set(s.cardId, list);
  }

  // De-dupe by cardId — top movers is per printing, not per item row.
  const seen = new Set<string>();
  const inputs: TopMoverInput[] = [];
  for (const it of items) {
    if (seen.has(it.cardId)) continue;
    seen.add(it.cardId);
    const list = byCard.get(it.cardId);
    if (!list || list.length < 2) continue;
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    const finishKey =
      it.foil === "FOIL"
        ? "priceUsdFoil"
        : it.foil === "ETCHED"
          ? "priceUsdEtched"
          : "priceUsd";
    const latestUsd =
      toNumber(last[finishKey]) ?? toNumber(last.priceUsd);
    const previousUsd =
      toNumber(prev[finishKey]) ?? toNumber(prev.priceUsd);
    const changePct = computePriceChangePct(latestUsd, previousUsd);
    if (latestUsd == null) continue;
    inputs.push({
      cardId: it.cardId,
      name: it.card.name,
      setCode: it.card.setCode,
      latestUsd,
      changePct,
    });
  }
  return pickTopMovers(inputs, 5);
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <p
        style={{
          color: "var(--ink-2)",
          fontSize: 14,
          marginBottom: 20,
        }}
      >
        Your grimoire is empty. Start building your collection.
      </p>
      <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
        <Link href="/collection/new" className="btn btn-primary">
          Add a card
        </Link>
        <Link href="/import" className="btn btn-ghost">
          Import CSV
        </Link>
      </div>
    </div>
  );
}
