import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestUsdToMxn, toNumber } from "@/lib/money";
import { pickPriceForFinish } from "@/lib/pricing";
import { computeGap } from "@/lib/wishlist-helpers";
import { Sparkline } from "@/components/Sparkline";
import { WishlistEditForm } from "./WishlistEditForm";
import { WishlistDeleteButton } from "./WishlistDeleteButton";

export default async function WishlistItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const user = await requireUser();
  const { itemId } = await params;

  const item = await prisma.wishlistItem.findUnique({
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

  const [dbUser, rate, ownedCount, existingTags] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayCurrency: true },
    }),
    getLatestUsdToMxn(),
    prisma.collectionItem.aggregate({
      where: { userId: user.id, cardId: item.cardId },
      _sum: { quantity: true },
    }),
    prisma.wishlistItem.findMany({
      where: { userId: user.id, tag: { not: null } },
      select: { tag: true },
      distinct: ["tag"],
      orderBy: { tag: "asc" },
    }),
  ]);

  const currency = dbUser?.displayCurrency ?? "USD";
  const currentUsd = pickPriceForFinish(item.card, "NORMAL");
  const maxUsd = toNumber(item.maxPriceUsd);
  const gap = computeGap(currentUsd, maxUsd);
  const owned = ownedCount._sum.quantity ?? 0;
  const tagOptions = existingTags.map((t) => t.tag!).filter(Boolean);

  const snapshots = item.card.prices.map((p) => ({
    date: p.snapshotDate,
    usd: toNumber(p.priceUsd),
  }));
  const valid = snapshots.filter(
    (s): s is { date: Date; usd: number } => s.usd != null,
  );
  const values = valid.map((s) => s.usd);
  const first = valid[0]?.usd ?? null;
  const last = valid[valid.length - 1]?.usd ?? null;
  const delta = first != null && last != null ? last - first : null;
  const pct = first && last && first !== 0 ? ((last - first) / first) * 100 : null;

  return (
    <div
      className="detail-layout"
      style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 32 }}
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
        }}
      >
        <div className="card-art" style={{ width: "100%", filter: "drop-shadow(0 8px 24px oklch(0 0 0 / 0.4))" }}>
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
          style={{ fontSize: 10, color: "var(--ink-3)", textAlign: "center", lineHeight: 1.6 }}
        >
          {item.card.setName} · #{item.card.collectorNumber}
        </div>
      </div>

      {/* Right: info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Header */}
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
          {item.card.oracleText && (
            <p style={{ color: "var(--ink-1)", fontSize: 13, lineHeight: 1.6, marginTop: 12, whiteSpace: "pre-line" }}>
              {item.card.oracleText}
            </p>
          )}
        </div>

        {owned > 0 && (
          <div className="chip warn">
            You own {owned} in your collection
          </div>
        )}

        {/* Stats */}
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="stat">
            <div className="stat-label">Wanted</div>
            <div className="stat-value">{item.quantityWanted}</div>
            <div className="stat-sub">
              <PriorityChip priority={item.priority} />
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Current price</div>
            <div className="stat-value" style={{ fontSize: 20 }}>
              {formatMoney(currentUsd, currency, rate)}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Max price</div>
            <div className="stat-value" style={{ fontSize: 20 }}>
              {maxUsd != null ? formatMoney(maxUsd, currency, rate) : "No limit"}
            </div>
            {gap != null && (
              <div className="stat-sub">
                <span className={`chip ${gap <= 0 ? "pos" : "neg"}`}>
                  {gap <= 0 ? "▼" : "▲"} {formatMoney(Math.abs(gap), currency, rate)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {item.tag && (
          <div style={{ display: "flex", gap: 6 }}>
            <span className="chip">{item.tag}</span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <WishlistDeleteButton itemId={itemId} cardName={item.card.name} />
          <Link href="/wishlist" className="btn btn-ghost" style={{ marginLeft: "auto" }}>
            ← Back to wishlist
          </Link>
        </div>

        {/* Edit form */}
        <WishlistEditForm
          itemId={itemId}
          defaultValues={{
            quantityWanted: item.quantityWanted,
            maxPriceUsd: maxUsd != null ? maxUsd.toString() : "",
            priority: item.priority,
            tag: item.tag ?? "",
            notes: item.notes ?? "",
          }}
          tagOptions={tagOptions}
        />

        {/* Price history */}
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
          <div style={{ padding: "20px 18px", height: 140 }}>
            <Sparkline
              values={values}
              ariaLabel={`Weekly USD price for ${item.card.name}, ${valid.length} data points`}
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
        </div>
      </div>
    </div>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  const cls = priority === "HIGH" ? "neg" : priority === "MEDIUM" ? "warn" : "";
  return <span className={`chip ${cls}`}>{priority}</span>;
}
