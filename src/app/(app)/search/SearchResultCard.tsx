import Link from "next/link";
import Image from "next/image";
import { RarityDot } from "@/components/RarityDot";
import { ManaCost } from "@/components/ManaCost";

type SearchResultCardProps = {
  card: {
    id: string;
    name: string;
    setCode: string;
    setName: string;
    rarity: string;
    manaCost: string | null;
    imageNormal: string | null;
    latestUsd: { toString(): string } | null;
  };
  /** Total quantity owned by the user; 0 = not owned */
  ownedCount: number;
  currency: "USD" | "MXN";
  rate: number;
};

function formatUsd(val: { toString(): string } | null): string {
  if (!val) return "—";
  const n = parseFloat(val.toString());
  if (isNaN(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function SearchResultCard({
  card,
  ownedCount,
  currency,
  rate,
}: SearchResultCardProps) {
  const priceDisplay =
    currency === "MXN" && card.latestUsd
      ? `$${(parseFloat(card.latestUsd.toString()) * rate).toFixed(0)} MXN`
      : formatUsd(card.latestUsd);

  // If owned → link to collection filtered by this card; otherwise link to add
  const actionHref =
    ownedCount > 0
      ? `/collection?q=${encodeURIComponent(card.name)}`
      : `/collection/new?pick=${card.id}`;

  return (
    <Link href={actionHref} className="coll-card search-result-card" style={{ textDecoration: "none" }}>
      <div className="card-art">
        {card.imageNormal ? (
          <Image
            src={card.imageNormal}
            alt={card.name}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              className="serif"
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                padding: "0 8px",
                textAlign: "center",
              }}
            >
              {card.name}
            </span>
          </div>
        )}
      </div>

      {/* Owned badge */}
      {ownedCount > 0 && (
        <div className="coll-card-qty" style={{ borderColor: "var(--pos)", color: "var(--pos)" }}>
          ×{ownedCount}
        </div>
      )}

      <div className="coll-card-meta">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 4,
          }}
        >
          <RarityDot rarity={card.rarity} />
          <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
            {card.setCode.toUpperCase()}
          </span>
        </div>
        <div className="coll-card-name">{card.name}</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 2,
          }}
        >
          <div className="coll-card-price">{priceDisplay}</div>
          <ManaCost cost={card.manaCost} />
        </div>
      </div>
    </Link>
  );
}
