"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Currency } from "@prisma/client";
import { groupCards, sortCards, type ListItem } from "@/lib/list-controls";
import type { ScopedListPrefs } from "@/lib/list-prefs";
import { ListControls } from "@/components/ListControls";
import { useIsMobile } from "@/lib/useIsMobile";
import { formatMoney } from "@/lib/money";
import { RarityDot } from "@/components/RarityDot";
import { ManaCost } from "@/components/ManaCost";
import { CardHoverPreview } from "@/components/CardHoverPreview";
import type { Locale } from "@/lib/i18n";

export type CollectionRow = ListItem & {
  itemId: string;
  imageNormal: string | null;
  manaCost: string;
  collectorNumber: string;
  foil: "NORMAL" | "FOIL" | "ETCHED";
  condition: string;
  collectionName: string;
  totalUsd: number;
};

type Props = {
  rows: CollectionRow[];
  currency: Currency;
  rate: number;
  showAll: boolean;
  locale: Locale;
  initialPrefs: ScopedListPrefs;
};

export function CollectionListView({ rows, currency, rate, showAll, locale, initialPrefs }: Props) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const isMobile = useIsMobile();
  const effectiveView = isMobile && prefs.view === "stacks" ? "text" : prefs.view;

  const groups = useMemo(
    () => groupCards(sortCards(rows, prefs.sort), prefs.group),
    [rows, prefs.sort, prefs.group],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ListControls scope="collection" prefs={prefs} onChange={setPrefs} locale={locale} />

      {effectiveView === "grid" && (
        <GroupedSections groups={groups} render={(g) => (
          <GridView rows={g.items} currency={currency} rate={rate} showAll={showAll} />
        )} />
      )}
      {effectiveView === "stacks" && (
        <GroupedSections groups={groups} render={(g) => (
          <StacksView rows={g.items} currency={currency} rate={rate} />
        )} />
      )}
      {effectiveView === "text" && (
        <GroupedSections groups={groups} render={(g) => (
          <TextView rows={g.items} currency={currency} rate={rate} showAll={showAll} />
        )} />
      )}
    </div>
  );
}

function GroupedSections({
  groups,
  render,
}: {
  groups: ReturnType<typeof groupCards<CollectionRow>>;
  render: (g: ReturnType<typeof groupCards<CollectionRow>>[number]) => React.ReactNode;
}) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {g.label && (
            <div className="eyebrow" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{g.label}</span>
              <span style={{ color: "var(--accent)" }}>{g.items.length}</span>
            </div>
          )}
          {render(g)}
        </div>
      ))}
    </>
  );
}

// ── Grid view (existing visual grid) ────────────────────────────────────────

function GridView({
  rows,
  currency,
  rate,
  showAll,
}: {
  rows: CollectionRow[];
  currency: Currency;
  rate: number;
  showAll: boolean;
}) {
  return (
    <div className="coll-grid">
      {rows.map((r) => (
        <Link
          key={r.itemId}
          href={`/collection/${r.itemId}`}
          className={`coll-card${r.foil !== "NORMAL" ? " is-foil" : ""}`}
        >
          <div className="card-art">
            {r.imageNormal ? (
              <Image src={r.imageNormal} alt={r.card.name} width={244} height={340} unoptimized />
            ) : (
              <div aria-hidden="true" style={{ width: "100%", height: "100%", background: "var(--bg-2)" }} />
            )}
          </div>
          <div className="coll-card-qty">×{r.quantity}</div>
          <div className="coll-card-meta">
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <RarityDot rarity={r.card.rarity} />
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                {r.card.setCode.toUpperCase()} · {r.collectorNumber}
              </span>
            </div>
            <div className="coll-card-name">{r.card.name}</div>
            <div className="coll-card-price">{formatMoney(r.totalUsd, currency, rate)}</div>
            {showAll && (
              <div
                className="mono"
                style={{
                  fontSize: 9,
                  color: "var(--accent)",
                  background: "oklch(0.78 0.14 78 / 0.12)",
                  borderRadius: 3,
                  padding: "1px 5px",
                  marginTop: 3,
                  display: "inline-block",
                }}
              >
                {r.collectionName}
              </div>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

// ── Stacks view (Archidekt-style stacked card art, reuses deck-column CSS) ──

function StacksView({ rows, currency, rate }: { rows: CollectionRow[]; currency: Currency; rate: number }) {
  return (
    <div className="deck-columns">
      <div className="deck-column" style={{ width: "100%" }}>
        {rows.map((r) => (
          <Link key={r.itemId} href={`/collection/${r.itemId}`} className="deck-stack-item" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
            <div className="deck-stack-row">
              <ManaCost cost={r.manaCost} />
              {r.quantity > 1 && <span className="deck-stack-qty">{r.quantity}×</span>}
              <span className="deck-stack-name">{r.card.name}</span>
              <span className="deck-stack-price">{formatMoney(r.totalUsd, currency, rate)}</span>
            </div>
            <div className="deck-stack-img">
              {r.imageNormal ? (
                <Image
                  src={r.imageNormal}
                  alt={r.card.name}
                  width={220}
                  height={308}
                  unoptimized
                  style={{ width: "100%", height: "auto", display: "block", borderRadius: "0 0 6px 6px" }}
                />
              ) : (
                <div style={{ height: 140, background: "var(--bg-3)" }} />
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Text view (existing table/list) ─────────────────────────────────────────

function TextView({
  rows,
  currency,
  rate,
  showAll,
}: {
  rows: CollectionRow[];
  currency: Currency;
  rate: number;
  showAll: boolean;
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="panel hidden md:block" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <caption className="sr-only">Collection items</caption>
          <thead>
            <tr>
              <th></th>
              <th>Card</th>
              <th>Cost</th>
              <th>Set</th>
              {showAll && <th>Folder</th>}
              <th className="num">Qty</th>
              <th>Finish</th>
              <th>Cond.</th>
              <th className="num">Unit</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId} style={{ cursor: "pointer" }}>
                <td style={{ width: 24 }}>
                  <RarityDot rarity={r.card.rarity} />
                </td>
                <td>
                  <CardHoverPreview imageUrl={r.imageNormal} cardName={r.card.name}>
                    <Link
                      href={`/collection/${r.itemId}`}
                      style={{
                        fontFamily: "var(--font-crimson-pro), Georgia, serif",
                        fontSize: 14,
                        color: "var(--ink-0)",
                        textDecoration: "none",
                      }}
                    >
                      {r.card.name}
                    </Link>
                  </CardHoverPreview>
                </td>
                <td>
                  <ManaCost cost={r.manaCost} />
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>
                    {r.card.setCode.toUpperCase()}
                  </span>
                </td>
                {showAll && (
                  <td>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {r.collectionName}
                    </span>
                  </td>
                )}
                <td className="num">{r.quantity}</td>
                <td>
                  {r.foil === "NORMAL" ? (
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      —
                    </span>
                  ) : (
                    <span className="foil-chip">{r.foil}</span>
                  )}
                </td>
                <td>
                  <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {r.condition}
                  </span>
                </td>
                <td className="num">{formatMoney(r.price ?? null, currency, rate)}</td>
                <td className="num" style={{ color: "var(--accent)" }}>
                  {formatMoney(r.totalUsd, currency, rate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="panel md:hidden" style={{ padding: 0 }}>
        {rows.map((r) => (
          <Link
            key={r.itemId}
            href={`/collection/${r.itemId}`}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "12px 18px",
              borderBottom: "1px solid var(--line-soft)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <RarityDot rarity={r.card.rarity} />
                <CardHoverPreview imageUrl={r.imageNormal} cardName={r.card.name} style={{ minWidth: 0, overflow: "hidden" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-crimson-pro), Georgia, serif",
                      fontSize: 14,
                      color: "var(--ink-0)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                    }}
                  >
                    {r.card.name}
                  </span>
                </CardHoverPreview>
              </div>
              <div
                className="mono"
                style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}
              >
                <span>
                  {r.card.setCode.toUpperCase()} · {r.quantity}× · {r.condition}
                  {showAll && ` · ${r.collectionName}`}
                </span>
                {r.foil !== "NORMAL" && <span className="foil-chip">{r.foil}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                {formatMoney(r.totalUsd, currency, rate)}
              </div>
              <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                {formatMoney(r.price ?? null, currency, rate)}/u
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
