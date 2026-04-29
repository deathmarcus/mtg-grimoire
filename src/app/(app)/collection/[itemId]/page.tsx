import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestUsdToMxn, toNumber } from "@/lib/money";
import { pickPriceForFinish } from "@/lib/pricing";
import { parseLegalities } from "@/lib/card-detail";
import { Sparkline } from "@/components/Sparkline";
import { updateItemQuantity } from "../actions";
import { DeleteButton } from "./DeleteButton";
import { DetailTabs } from "./DetailTabs";
import { InlineEditForm } from "./InlineEditForm";
import { EditionsTab, type EditionRow } from "./EditionsTab";
import { RulingsTab } from "./RulingsTab";
import { IconEdit } from "@/components/Icons";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const user = await requireUser();
  const { itemId } = await params;

  const item = await prisma.collectionItem.findUnique({
    where: { id: itemId },
    include: {
      card: {
        include: {
          prices: { orderBy: { snapshotDate: "asc" }, take: 26 },
        },
      },
    },
  });

  if (!item || item.userId !== user.id) notFound();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { displayCurrency: true },
  });
  const currency = dbUser?.displayCurrency ?? "USD";
  const rate = await getLatestUsdToMxn();

  const priceUsd = pickPriceForFinish(item.card, item.foil);

  // Other printings of the same card
  const otherPrintings = await prisma.card.findMany({
    where: {
      name: item.card.name,
      id: { not: item.card.id },
    },
    select: {
      id: true,
      setCode: true,
      setName: true,
      collectorNumber: true,
      rarity: true,
      latestUsd: true,
      latestUsdFoil: true,
      latestUsdEtched: true,
      scryfallUpdatedAt: true,
    },
    orderBy: { scryfallUpdatedAt: "desc" },
    take: 60,
  });
  const editions: EditionRow[] = otherPrintings.map((c) => ({
    id: c.id,
    setCode: c.setCode,
    setName: c.setName,
    collectorNumber: c.collectorNumber,
    rarity: c.rarity,
    releasedYear: c.scryfallUpdatedAt
      ? c.scryfallUpdatedAt.toISOString().slice(0, 4)
      : null,
    latestUsd: c.latestUsd,
    latestUsdFoil: c.latestUsdFoil,
    latestUsdEtched: c.latestUsdEtched,
  }));

  const legalities = parseLegalities(item.card.legalities);

  async function incAction() {
    "use server";
    await updateItemQuantity(itemId, item!.quantity + 1);
  }
  async function decAction() {
    "use server";
    await updateItemQuantity(itemId, item!.quantity - 1);
  }

  const overviewPanel = (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat">
          <div className="stat-label">Quantity</div>
          <div className="stat-value">{item.quantity}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Unit price</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {formatMoney(priceUsd ?? null, currency, rate)}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Line total</div>
          <div className="stat-value" style={{ fontSize: 20, color: "var(--accent)" }}>
            {formatMoney((priceUsd ?? 0) * item.quantity, currency, rate)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span className="chip">{item.foil}</span>
        <span className="chip">{item.language.toUpperCase()}</span>
        <span className="chip">{item.condition}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <InlineEditForm
          itemId={itemId}
          initial={{
            quantity: item.quantity,
            foil: item.foil,
            language: item.language,
            condition: item.condition,
            collectionId: item.collectionId,
            acquiredPrice:
              item.acquiredPrice != null ? Number(item.acquiredPrice) : null,
            notes: item.notes,
          }}
        />
        <Link href={`/collection/${itemId}/edit`} className="btn">
          <IconEdit size={12} /> Full edit
        </Link>
        <form action={decAction}>
          <button
            type="submit"
            className="btn btn-sm"
            aria-label={`Remove one copy of ${item.card.name}`}
          >
            − Remove one
          </button>
        </form>
        <form action={incAction}>
          <button
            type="submit"
            className="btn btn-sm"
            aria-label={`Add one copy of ${item.card.name}`}
          >
            + Add one
          </button>
        </form>
        <Link href={`/collection/${itemId}/replace-printing`} className="btn btn-ghost btn-sm">
          Replace printing
        </Link>
        <DeleteButton itemId={itemId} cardName={item.card.name} />
      </div>
    </div>
  );

  const historyPanel = (
    <PriceHistorySection
      snapshots={item.card.prices.map((p) => ({
        date: p.snapshotDate,
        usd:
          item.foil === "FOIL"
            ? toNumber(p.priceUsdFoil)
            : item.foil === "ETCHED"
              ? toNumber(p.priceUsdEtched)
              : toNumber(p.priceUsd),
      }))}
      currency={currency}
      rate={rate}
      cardName={item.card.name}
    />
  );

  const editionsPanel = (
    <EditionsTab editions={editions} currency={currency} rate={rate} />
  );

  const rulingsPanel = (
    <RulingsTab
      oracleText={item.card.oracleText}
      typeLine={item.card.typeLine}
      manaCost={item.card.manaCost}
      legalities={legalities}
    />
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: 32,
      }}
      className="detail-layout"
    >
      {/* Left: card art */}
      <div
        style={{
          background: "linear-gradient(180deg, var(--bg-2), var(--bg-1))",
          padding: 24,
          borderRadius: "var(--r-md)",
          border: "1px solid var(--line-soft)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          alignSelf: "start",
          position: "sticky",
          top: 80,
        }}
      >
        <div
          className="card-art"
          style={{ width: "100%", filter: "drop-shadow(0 8px 24px oklch(0 0 0 / 0.4))" }}
        >
          {item.card.imageLarge || item.card.imageNormal ? (
            <Image
              src={item.card.imageLarge ?? item.card.imageNormal!}
              alt={item.card.name}
              width={340}
              height={474}
              unoptimized
            />
          ) : (
            <div
              aria-hidden="true"
              style={{ width: "100%", height: "100%", background: "var(--bg-3)" }}
            />
          )}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: "var(--ink-3)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          {item.card.setName} · #{item.card.collectorNumber}
          <br />
          Image via Scryfall
        </div>
      </div>

      {/* Right: header + tabs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {item.card.setCode.toUpperCase()} · #{item.card.collectorNumber}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-crimson-pro), Georgia, serif",
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            {item.card.name}
          </h1>
          {item.card.typeLine && (
            <p style={{ color: "var(--ink-2)", fontSize: 13, marginTop: 4 }}>
              {item.card.typeLine}
            </p>
          )}
        </div>

        <DetailTabs
          overview={overviewPanel}
          history={historyPanel}
          editions={editionsPanel}
          rulings={rulingsPanel}
          editionsCount={editions.length}
        />

        <Link
          href="/collection"
          className="btn btn-ghost"
          style={{ alignSelf: "flex-start" }}
        >
          ← Back to collection
        </Link>
      </div>
    </div>
  );
}

function PriceHistorySection({
  snapshots,
  currency,
  rate,
  cardName,
}: {
  snapshots: { date: Date; usd: number | null }[];
  currency: "USD" | "MXN";
  rate: number;
  cardName: string;
}) {
  const valid = snapshots.filter(
    (s): s is { date: Date; usd: number } => s.usd != null,
  );
  const values = valid.map((s) => s.usd);
  const first = valid[0]?.usd ?? null;
  const last = valid[valid.length - 1]?.usd ?? null;
  const delta = first != null && last != null ? last - first : null;
  const pct = first && last && first !== 0 ? ((last - first) / first) * 100 : null;

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">Price history</div>
          {delta != null && (
            <span className={`chip ${delta >= 0 ? "pos" : "neg"}`} style={{ marginTop: 4 }}>
              {delta >= 0 ? "+" : ""}
              {formatMoney(Math.abs(delta), currency, rate)}{" "}
              {pct != null && `(${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`}
            </span>
          )}
        </div>
        <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
          {valid.length} snapshots
        </div>
      </div>
      {valid.length === 0 ? (
        <div className="panel-body">
          <p style={{ color: "var(--ink-2)", fontSize: 13 }}>
            No price snapshots yet. Run <code>npm run sync:weekly</code> to start
            building history.
          </p>
        </div>
      ) : (
        <>
          <div style={{ padding: "20px 18px", height: 140 }}>
            <Sparkline
              values={values}
              ariaLabel={`Weekly USD price for ${cardName}, ${valid.length} data points`}
            />
          </div>
          {valid.length >= 2 && (
            <div
              className="mono"
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "0 18px 14px",
                fontSize: 10,
                color: "var(--ink-3)",
              }}
            >
              <span>{valid[0].date.toISOString().slice(0, 10)}</span>
              <span style={{ color: "var(--accent)" }}>
                {formatMoney(last, currency, rate)}
              </span>
              <span>{valid[valid.length - 1].date.toISOString().slice(0, 10)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
