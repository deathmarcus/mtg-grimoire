"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import type { Currency } from "@prisma/client";
import { ManaCost } from "@/components/ManaCost";
import { formatMoney } from "@/lib/money";
import { removeCardFromDeck, updateDeckCard } from "../actions";
import type { ClientDeckCard } from "./types";
import { CardEditModal } from "./CardEditModal";

type Props = {
  deckId: string;
  mainCards: ClientDeckCard[];
  sideCards: ClientDeckCard[];
  currency: Currency;
  fxRate: number;
  commanderColors: Set<string>;
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

// ── Stacked card row (Archidekt-style) ─────────────────────────────────────

function StackCard({
  deckId,
  entry,
  currency,
  fxRate,
  isOutOfColor,
  onEdit,
}: {
  deckId: string;
  entry: ClientDeckCard;
  currency: Currency;
  fxRate: number;
  isOutOfColor: boolean;
  onEdit: (entry: ClientDeckCard) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleQtyChange(delta: number, e: React.MouseEvent) {
    e.stopPropagation();
    const newQty = entry.quantity + delta;
    if (newQty < 1) {
      startTransition(() => void removeCardFromDeck(deckId, entry.id));
      return;
    }
    const fd = new FormData();
    fd.set("quantity", String(newQty));
    startTransition(() => void updateDeckCard(deckId, entry.id, fd));
  }

  function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(() => void removeCardFromDeck(deckId, entry.id));
  }

  const value = (entry.card.latestUsd ?? 0) * entry.quantity;

  return (
    <div
      className="deck-stack-item"
      style={{ opacity: pending ? 0.5 : 1, cursor: "pointer" }}
      onClick={() => onEdit(entry)}
    >
      {/* Name row — always visible */}
      <div className="deck-stack-row">
        <ManaCost cost={entry.card.manaCost} />
        {entry.quantity > 1 && (
          <span className="deck-stack-qty">{entry.quantity}×</span>
        )}
        <span className="deck-stack-name">{entry.card.name}</span>
        {isOutOfColor && (
          <span
            style={{
              fontSize: 9,
              fontFamily: "var(--font-jetbrains-mono), monospace",
              color: "var(--neg)",
              border: "1px solid var(--neg)",
              borderRadius: 3,
              padding: "0 3px",
              lineHeight: 1.4,
              flexShrink: 0,
            }}
            title="Outside commander color identity"
          >
            ⚠
          </span>
        )}
        <span className="deck-stack-price">
          {value > 0 ? formatMoney(value, currency, fxRate) : ""}
        </span>
        <div className="deck-stack-controls">
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: "0 4px", fontSize: 12, lineHeight: 1 }}
            onClick={(e) => handleQtyChange(-1, e)}
            disabled={pending}
            aria-label="Decrease"
          >−</button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: "0 4px", fontSize: 12, lineHeight: 1 }}
            onClick={(e) => handleQtyChange(1, e)}
            disabled={pending}
            aria-label="Increase"
          >+</button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: "0 4px", fontSize: 12, lineHeight: 1, color: "var(--neg)" }}
            onClick={(e) => handleRemove(e)}
            disabled={pending}
            aria-label="Remove"
          >×</button>
        </div>
      </div>

      {/* Card image — hidden by default, expands downward on hover */}
      <div className="deck-stack-img">
        {entry.card.imageNormal ? (
          <Image
            src={entry.card.imageNormal}
            alt={entry.card.name}
            width={220}
            height={308}
            unoptimized
            style={{ width: "100%", height: "auto", display: "block", borderRadius: "0 0 6px 6px" }}
          />
        ) : (
          <div style={{ height: 140, background: "var(--bg-3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 11, color: "var(--ink-3)" }}>
              {entry.card.name}
            </span>
          </div>
        )}
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

export function MainboardTab({ deckId, mainCards, sideCards, currency, fxRate, commanderColors }: Props) {
  const [editEntry, setEditEntry] = useState<ClientDeckCard | null>(null);

  const commanderCards = mainCards.filter((c) => c.isCommander);
  const nonCommanderMain = mainCards.filter((c) => !c.isCommander);
  const groups = groupCards(nonCommanderMain);

  const totalMain = mainCards.reduce((s, c) => s + c.quantity, 0);
  const totalSide = sideCards.reduce((s, c) => s + c.quantity, 0);

  function isOutOfColor(card: ClientDeckCard) {
    if (commanderColors.size === 0) return false;
    return card.card.colorIdentity.some((col) => !commanderColors.has(col));
  }

  return (
    <>
      {editEntry && (
        <CardEditModal
          deckId={deckId}
          entry={editEntry}
          currency={currency}
          fxRate={fxRate}
          onClose={() => setEditEntry(null)}
        />
      )}

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
          <div className="deck-columns">
            {/* Commander column */}
            {commanderCards.length > 0 && (
              <div className="deck-column">
                <div className="deck-column-header">
                  <span>Commander</span>
                  <span>{commanderCards.reduce((s, c) => s + c.quantity, 0)}</span>
                </div>
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
            )}

            {/* Type columns */}
            {Array.from(groups.entries()).map(([type, cards]) => {
              const typeQty = cards.reduce((s, c) => s + c.quantity, 0);
              return (
                <div key={type} className="deck-column">
                  <div className="deck-column-header">
                    <span>{type}</span>
                    <span>{typeQty}</span>
                  </div>
                  {cards.map((c) => (
                    <StackCard
                      key={c.id}
                      deckId={deckId}
                      entry={c}
                      currency={currency}
                      fxRate={fxRate}
                      isOutOfColor={isOutOfColor(c)}
                      onEdit={setEditEntry}
                    />
                  ))}
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
    </>
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
