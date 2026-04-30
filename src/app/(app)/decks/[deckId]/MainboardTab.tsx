"use client";

import { useTransition } from "react";
import Image from "next/image";
import type { Currency } from "@prisma/client";
import { ManaCost } from "@/components/ManaCost";
import { formatMoney } from "@/lib/money";
import { removeCardFromDeck, updateDeckCard } from "../actions";
import type { ClientDeckCard } from "./types";

type Props = {
  deckId: string;
  mainCards: ClientDeckCard[];
  sideCards: ClientDeckCard[];
  currency: Currency;
  fxRate: number;
};

const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Land",
  "Other",
] as const;

type TypeGroup = (typeof TYPE_ORDER)[number];

function getTypeGroup(typeLine: string): TypeGroup {
  for (const t of TYPE_ORDER) {
    if (t === "Other") return "Other";
    if (typeLine.includes(t)) return t;
  }
  return "Other";
}

function groupCards(cards: ClientDeckCard[]): Map<TypeGroup, ClientDeckCard[]> {
  const groups = new Map<TypeGroup, ClientDeckCard[]>();
  for (const t of TYPE_ORDER) groups.set(t, []);
  for (const c of cards) {
    groups.get(getTypeGroup(c.card.typeLine))!.push(c);
  }
  for (const [k, v] of groups) {
    if (v.length === 0) groups.delete(k);
  }
  return groups;
}

// ── Single card image tile ──────────────────────────────────────────────────

function CardTile({
  deckId,
  entry,
  currency,
  fxRate,
}: {
  deckId: string;
  entry: ClientDeckCard;
  currency: Currency;
  fxRate: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleQtyChange(delta: number) {
    const newQty = entry.quantity + delta;
    if (newQty < 1) return handleRemove();
    const fd = new FormData();
    fd.set("quantity", String(newQty));
    startTransition(() => void updateDeckCard(deckId, entry.id, fd));
  }

  function handleRemove() {
    startTransition(() => void removeCardFromDeck(deckId, entry.id));
  }

  const value = (entry.card.latestUsd ?? 0) * entry.quantity;

  return (
    <div
      className="deck-card-tile"
      style={{ opacity: pending ? 0.5 : 1, transition: "opacity 150ms" }}
    >
      {/* Card image */}
      <div className="deck-card-img-wrap">
        {entry.card.imageNormal ? (
          <Image
            src={entry.card.imageNormal}
            alt={entry.card.name}
            fill
            unoptimized
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--bg-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 9,
                color: "var(--ink-3)",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {entry.card.name}
            </span>
          </div>
        )}

        {/* CMDR badge */}
        {entry.isCommander && (
          <span className="deck-card-cmdr-badge">CMDR</span>
        )}

        {/* Qty badge */}
        {entry.quantity > 1 && (
          <span className="deck-card-qty-badge">×{entry.quantity}</span>
        )}

        {/* Price overlay */}
        {value > 0 && (
          <div className="deck-card-price-overlay">
            {formatMoney(value, currency, fxRate)}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="deck-card-controls">
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: "1px 5px", minWidth: 22, fontSize: 14 }}
          onClick={() => handleQtyChange(-1)}
          disabled={pending}
          aria-label="Decrease quantity"
        >
          −
        </button>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 11,
            color: "var(--ink-2)",
            minWidth: 14,
            textAlign: "center",
          }}
        >
          {entry.quantity}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: "1px 5px", minWidth: 22, fontSize: 14 }}
          onClick={() => handleQtyChange(1)}
          disabled={pending}
          aria-label="Increase quantity"
        >
          +
        </button>
        <button
          className="btn btn-ghost btn-sm"
          style={{ padding: "1px 4px", color: "var(--neg)", marginLeft: "auto", fontSize: 14 }}
          onClick={handleRemove}
          disabled={pending}
          aria-label={`Remove ${entry.card.name}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Commander spotlight card ────────────────────────────────────────────────

function CommanderCard({
  deckId,
  entry,
  currency,
  fxRate,
}: {
  deckId: string;
  entry: ClientDeckCard;
  currency: Currency;
  fxRate: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(() => void removeCardFromDeck(deckId, entry.id));
  }

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      {/* Image */}
      <div
        style={{
          position: "relative",
          width: 120,
          height: 168,
          flexShrink: 0,
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid var(--accent)",
          boxShadow: "0 0 12px oklch(0.78 0.14 78 / 0.3)",
        }}
      >
        {entry.card.imageNormal ? (
          <Image
            src={entry.card.imageNormal}
            alt={entry.card.name}
            fill
            unoptimized
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "var(--bg-3)" }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>Commander</div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            marginBottom: 4,
            lineHeight: 1.2,
          }}
        >
          {entry.card.name}
        </div>
        <div style={{ marginBottom: 6 }}>
          <ManaCost cost={entry.card.manaCost} />
        </div>
        {entry.card.latestUsd != null && (
          <div
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 12,
              color: "var(--accent)",
              marginBottom: 8,
            }}
          >
            {formatMoney(entry.card.latestUsd, currency, fxRate)}
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={{ color: "var(--neg)", fontSize: 11 }}
          onClick={handleRemove}
          disabled={pending}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function MainboardTab({ deckId, mainCards, sideCards, currency, fxRate }: Props) {
  const commanderCards = mainCards.filter((c) => c.isCommander);
  const nonCommanderMain = mainCards.filter((c) => !c.isCommander);
  const groups = groupCards(nonCommanderMain);

  const totalMain = mainCards.reduce((s, c) => s + c.quantity, 0);
  const totalSide = sideCards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 28 }}>
      {/* ── Left: mainboard ── */}
      <div>
        <div
          className="eyebrow"
          style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}
        >
          <span>Mainboard</span>
          <span style={{ color: "var(--accent)" }}>{totalMain}</span>
        </div>

        {mainCards.length === 0 ? (
          <div
            style={{
              padding: "40px 0",
              textAlign: "center",
              color: "var(--ink-3)",
              fontSize: 13,
              fontStyle: "italic",
              fontFamily: "var(--font-display)",
            }}
          >
            No cards yet. Use the search above to add cards.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Commander section */}
            {commanderCards.length > 0 && (
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 10,
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "var(--accent)",
                    marginBottom: 10,
                    paddingBottom: 6,
                    borderBottom: "1px dashed var(--line-soft)",
                  }}
                >
                  Commander
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {commanderCards.map((c) => (
                    <CommanderCard
                      key={c.id}
                      deckId={deckId}
                      entry={c}
                      currency={currency}
                      fxRate={fxRate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Type groups — visual grid */}
            {Array.from(groups.entries()).map(([type, cards]) => {
              const typeQty = cards.reduce((s, c) => s + c.quantity, 0);
              return (
                <div key={type}>
                  <div
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 10,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "var(--accent)",
                      marginBottom: 10,
                      paddingBottom: 6,
                      borderBottom: "1px dashed var(--line-soft)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>{type}</span>
                    <span style={{ color: "var(--ink-3)" }}>{typeQty}</span>
                  </div>
                  <div className="deck-visual-grid">
                    {cards.map((c) => (
                      <CardTile
                        key={c.id}
                        deckId={deckId}
                        entry={c}
                        currency={currency}
                        fxRate={fxRate}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: considering list ── */}
      <div>
        <div
          className="eyebrow"
          style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}
        >
          <span>Considering</span>
          <span style={{ color: "var(--accent)" }}>{totalSide}</span>
        </div>

        {sideCards.length === 0 ? (
          <div
            style={{
              padding: "20px 0",
              textAlign: "center",
              color: "var(--ink-3)",
              fontSize: 12,
              fontStyle: "italic",
              fontFamily: "var(--font-display)",
            }}
          >
            Nothing here yet
          </div>
        ) : (
          <div className="panel" style={{ padding: 14 }}>
            {sideCards.map((c) => (
              <SideboardRow
                key={c.id}
                deckId={deckId}
                entry={c}
                currency={currency}
                fxRate={fxRate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SideboardRow({
  deckId,
  entry,
  currency,
  fxRate,
}: {
  deckId: string;
  entry: ClientDeckCard;
  currency: Currency;
  fxRate: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleQtyChange(delta: number) {
    const newQty = entry.quantity + delta;
    if (newQty < 1) return startTransition(() => void removeCardFromDeck(deckId, entry.id));
    const fd = new FormData();
    fd.set("quantity", String(newQty));
    startTransition(() => void updateDeckCard(deckId, entry.id, fd));
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 0",
        fontSize: 12,
        opacity: pending ? 0.5 : 1,
      }}
    >
      <button
        className="btn btn-ghost btn-sm"
        style={{ padding: "1px 4px", minWidth: 18 }}
        onClick={() => handleQtyChange(-1)}
        disabled={pending}
        aria-label="Decrease"
      >
        −
      </button>
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 11,
          color: "var(--ink-3)",
          width: 16,
          textAlign: "center",
        }}
      >
        {entry.quantity}
      </span>
      <button
        className="btn btn-ghost btn-sm"
        style={{ padding: "1px 4px", minWidth: 18 }}
        onClick={() => handleQtyChange(1)}
        disabled={pending}
        aria-label="Increase"
      >
        +
      </button>
      <ManaCost cost={entry.card.manaCost} />
      <span
        style={{
          flex: 1,
          fontFamily: "var(--font-display)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {entry.card.name}
      </span>
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          fontSize: 10,
          color: "var(--accent)",
        }}
      >
        {entry.card.latestUsd != null
          ? formatMoney(entry.card.latestUsd * entry.quantity, currency, fxRate)
          : ""}
      </span>
    </div>
  );
}
