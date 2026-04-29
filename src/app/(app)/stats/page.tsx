import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getLatestUsdToMxn } from "@/lib/money";
import { toNumber } from "@/lib/money-format";
import { pickPriceForFinish } from "@/lib/pricing";
import {
  aggregateValueByDate,
  type SnapshotRow,
  type ValuedItem,
} from "@/lib/dashboard";
import {
  getColorDistribution,
  getRarityDistribution,
  getMostValuableItems,
  type ColorDistributionInput,
  type RarityDistributionInput,
  type ValuableItem,
} from "@/lib/stats";
import { ValueHistoryChart } from "./ValueHistoryChart";
import { ColorDistributionChart } from "./ColorDistributionChart";
import { RarityDistributionChart } from "./RarityDistributionChart";
import { MostValuableTable, type MostValuableRow } from "./MostValuableTable";
import { t, type Locale } from "@/lib/i18n";

export const metadata = { title: "Stats — Grimoire" };

export default async function StatsPage() {
  const user = await requireUser();

  // Fetch user preferences + collection items with card data
  const [dbUser, items, rate] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayCurrency: true, locale: true },
    }),
    prisma.collectionItem.findMany({
      where: { userId: user.id },
      include: {
        card: {
          select: {
            id: true,
            name: true,
            setCode: true,
            rarity: true,
            colorIdentity: true,
            imageSmall: true,
            latestUsd: true,
            latestUsdFoil: true,
            latestUsdEtched: true,
          },
        },
        collection: { select: { excludeFromTotals: true } },
      },
    }),
    getLatestUsdToMxn(),
  ]);

  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;

  // --------------------------------------------------------------------------
  // Value history (reuses dashboard logic — all owned snapshots)
  // --------------------------------------------------------------------------

  // Collect distinct cardIds owned by the user
  const ownedCardIds = [...new Set(items.map((it) => it.cardId))];

  const snapshots = await prisma.cardPrice.findMany({
    where: { cardId: { in: ownedCardIds } },
    orderBy: { snapshotDate: "asc" },
    select: {
      cardId: true,
      snapshotDate: true,
      priceUsd: true,
      priceUsdFoil: true,
      priceUsdEtched: true,
    },
  });

  const valuedItems: ValuedItem[] = items.map((it) => ({
    cardId: it.cardId,
    quantity: it.quantity,
    foil: it.foil,
    excluded: it.collection.excludeFromTotals,
  }));

  const valueHistory = aggregateValueByDate(
    valuedItems,
    snapshots as SnapshotRow[],
  );

  // --------------------------------------------------------------------------
  // Color distribution
  // --------------------------------------------------------------------------

  const colorInputs: ColorDistributionInput[] = items.map((it) => ({
    colorIdentity: it.card.colorIdentity,
    latestUsd: pickPriceForFinish(it.card, it.foil),
    quantity: it.quantity,
  }));
  const colorDist = getColorDistribution(colorInputs);

  // --------------------------------------------------------------------------
  // Rarity distribution
  // --------------------------------------------------------------------------

  // Expand by quantity so each physical card is counted
  const rarityInputs: RarityDistributionInput[] = items.flatMap((it) =>
    Array.from({ length: it.quantity }, () => ({ rarity: it.card.rarity })),
  );
  const rarityDist = getRarityDistribution(rarityInputs);

  // --------------------------------------------------------------------------
  // Most valuable (top 15)
  // --------------------------------------------------------------------------

  // Fetch last 6 price snapshots for each owned card for mini-sparklines
  const priceHistoryMap = new Map<string, number[]>();
  for (const cardId of ownedCardIds) {
    priceHistoryMap.set(cardId, []);
  }
  // snapshots are already fetched and sorted asc; extract last 6 per card
  const snapshotsByCard = new Map<string, SnapshotRow[]>();
  for (const s of snapshots as SnapshotRow[]) {
    const arr = snapshotsByCard.get(s.cardId) ?? [];
    arr.push(s);
    snapshotsByCard.set(s.cardId, arr);
  }
  for (const [cardId, snaps] of snapshotsByCard.entries()) {
    // snaps already sorted asc
    const last6 = snaps.slice(-6).map((s) => toNumber(s.priceUsd) ?? 0);
    priceHistoryMap.set(cardId, last6);
  }

  type ValuableInput = ValuableItem & {
    collectionItemId: string;
    name: string;
    setCode: string;
    rarity: string;
    imageSmall: string | null;
    foil: string;
    priceHistory: number[];
  };

  // Build valuable item inputs — one per CollectionItem
  const valuableInputs: ValuableInput[] = items.map((it) => {
    const latestUsd = toNumber(pickPriceForFinish(it.card, it.foil));
    return {
      id: it.id,
      collectionItemId: it.id,
      cardId: it.cardId,
      name: it.card.name,
      setCode: it.card.setCode,
      rarity: it.card.rarity,
      imageSmall: it.card.imageSmall,
      foil: it.foil,
      quantity: it.quantity,
      latestUsd,
      priceHistory: priceHistoryMap.get(it.cardId) ?? [],
    };
  });

  const top15 = getMostValuableItems(valuableInputs, 15);

  const mostValuableRows: MostValuableRow[] = top15.map((v) => ({
    id: v.collectionItemId,
    cardId: v.cardId,
    name: v.name,
    setCode: v.setCode,
    rarity: v.rarity,
    quantity: v.quantity,
    latestUsd: v.latestUsd,
    imageSmall: v.imageSmall,
    foil: v.foil,
    priceHistory: v.priceHistory,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Value history — full width */}
      <ValueHistoryChart
        history={valueHistory}
        currency={currency}
        rate={rate}
      />

      {/* Color dist + Rarity dist — 2-col grid */}
      <div className="stats-two-col">
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">{t("page.stats.colorDist", locale)}</div>
          </div>
          <ColorDistributionChart
            data={colorDist}
            currency={currency}
            rate={rate}
          />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">{t("page.stats.rarityDist", locale)}</div>
          </div>
          <RarityDistributionChart data={rarityDist} />
        </div>
      </div>

      {/* Most valuable — full width */}
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">{t("page.stats.mostValuable", locale)}</div>
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 10,
              color: "var(--ink-3)",
            }}
          >
            top 15 by total value
          </span>
        </div>
        <MostValuableTable
          items={mostValuableRows}
          currency={currency}
          rate={rate}
        />
      </div>
    </div>
  );
}
