import Link from "next/link";
import Image from "next/image";
import { formatMoney } from "@/lib/money";
import { TargetPriceBar } from "@/components/TargetPriceBar";

type Props = {
  id: string;
  name: string;
  setCode: string;
  rarity: string;
  imageSmall: string | null;
  priority: string;
  quantityWanted: number;
  currentUsd: number | null;
  maxPriceUsd: number | null;
  tag: string | null;
  notes: string | null;
  currency: "USD" | "MXN";
  rate: number;
};

export function WishlistCard({
  id,
  name,
  setCode,
  rarity,
  imageSmall,
  priority,
  quantityWanted,
  currentUsd,
  maxPriceUsd,
  tag,
  notes,
  currency,
  rate,
}: Props) {
  const prioChipClass =
    priority === "HIGH" ? "neg" : priority === "MEDIUM" ? "warn" : "";
  return (
    <Link
      href={`/wishlist/${id}`}
      className="panel"
      style={{
        padding: 0,
        display: "flex",
        textDecoration: "none",
        color: "inherit",
        minHeight: 120,
      }}
    >
      <div
        style={{
          width: 80,
          flexShrink: 0,
          background: "var(--bg-2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {imageSmall ? (
          <Image
            src={imageSmall}
            alt={name}
            fill
            sizes="80px"
            unoptimized
            style={{ objectFit: "cover", objectPosition: "center top" }}
          />
        ) : null}
      </div>
      <div
        style={{
          flex: 1,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-crimson-pro), Georgia, serif",
                fontSize: 15,
                color: "var(--ink-0)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--ink-3)",
                marginTop: 2,
                textTransform: "uppercase",
              }}
            >
              {setCode} · {rarity}
            </div>
          </div>
          <span className={`chip ${prioChipClass}`} style={{ fontSize: 9, flexShrink: 0 }}>
            {priority}
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <div>
            <div className="eyebrow">Current</div>
            <div className="mono" style={{ fontSize: 14, color: "var(--ink-0)" }}>
              {formatMoney(currentUsd, currency, rate)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow">Target</div>
            <div className="mono" style={{ fontSize: 14, color: "var(--accent)" }}>
              {maxPriceUsd != null ? formatMoney(maxPriceUsd, currency, rate) : "—"}
            </div>
          </div>
        </div>

        <TargetPriceBar currentUsd={currentUsd} maxPriceUsd={maxPriceUsd} />

        <div
          className="mono"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "var(--ink-3)",
            marginTop: "auto",
          }}
        >
          <span>×{quantityWanted}</span>
          {tag && <span>{tag}</span>}
        </div>

        {notes && (
          <div
            style={{
              fontFamily: "var(--font-crimson-pro), Georgia, serif",
              fontSize: 12,
              fontStyle: "italic",
              color: "var(--ink-2)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            &ldquo;{notes}&rdquo;
          </div>
        )}
      </div>
    </Link>
  );
}
