"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import type { Currency } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { removeCardFromDeck, updateDeckCard, getPrintingsByName } from "../actions";
import type { PrintingResult } from "../actions";
import type { ClientDeckCard } from "./types";

type Props = {
  deckId: string;
  entry: ClientDeckCard;
  currency: Currency;
  fxRate: number;
  onClose: () => void;
};

export function CardEditModal({ deckId, entry, currency, fxRate, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [qty, setQty] = useState(entry.quantity);
  const [board, setBoard] = useState<"MAIN" | "SIDE">(entry.board);
  const [category, setCategory] = useState(entry.category ?? "");
  const [selectedCardId, setSelectedCardId] = useState(entry.card.id);
  const [printings, setPrintings] = useState<PrintingResult[]>([]);

  useEffect(() => {
    getPrintingsByName(entry.card.name).then(setPrintings);
  }, [entry.card.name]);

  const currentImage =
    printings.find((p) => p.id === selectedCardId)?.imageSmall ??
    entry.card.imageNormal;

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    const fd = new FormData();
    fd.set("quantity", String(qty));
    fd.set("board", board);
    if (category) fd.set("category", category);
    else fd.set("category", "");
    if (selectedCardId !== entry.card.id) fd.set("cardId", selectedCardId);
    startTransition(async () => {
      await updateDeckCard(deckId, entry.id, fd);
      onClose();
    });
  }

  function handleRemove() {
    startTransition(async () => {
      await removeCardFromDeck(deckId, entry.id);
      onClose();
    });
  }

  const selectedPrinting = printings.find((p) => p.id === selectedCardId);
  const displayPrice = selectedPrinting?.latestUsd != null
    ? formatMoney(selectedPrinting.latestUsd * qty, currency, fxRate)
    : entry.card.latestUsd != null
      ? formatMoney(entry.card.latestUsd * qty, currency, fxRate)
      : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "oklch(0 0 0 / 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="panel"
        style={{
          width: "min(96vw, 560px)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          position: "relative",
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${entry.card.name}`}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          {/* Card image */}
          <div style={{ flexShrink: 0, width: 120 }}>
            {currentImage ? (
              <Image
                src={currentImage}
                alt={entry.card.name}
                width={120}
                height={168}
                unoptimized
                style={{ display: "block", borderRadius: 6, width: 120, height: "auto" }}
              />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 168,
                  background: "var(--bg-3)",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                }}
              />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {entry.card.name}
              </h2>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                aria-label="Close"
                style={{ fontSize: 18, lineHeight: 1, padding: "2px 8px", flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 10,
                color: "var(--ink-3)",
                marginBottom: 12,
              }}
            >
              {entry.card.typeLine}
            </div>

            {displayPrice && (
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 14,
                  color: "var(--accent)",
                }}
              >
                {displayPrice}
              </div>
            )}
          </div>
        </div>

        {/* Form fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quantity */}
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Quantity</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: 32, height: 32, fontSize: 18, padding: 0 }}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={pending}
              >
                −
              </button>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 18,
                  width: 32,
                  textAlign: "center",
                }}
              >
                {qty}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: 32, height: 32, fontSize: 18, padding: 0 }}
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                disabled={pending}
              >
                +
              </button>
            </div>
          </div>

          {/* Board */}
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>Board</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["MAIN", "SIDE"] as const).map((b) => (
                <button
                  key={b}
                  className={`btn btn-sm ${board === b ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setBoard(b)}
                  disabled={pending}
                >
                  {b === "MAIN" ? "Mainboard" : "Considering"}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
              Category
            </label>
            <input
              className="input"
              list="category-suggestions"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Ramp, Draw, Removal…"
              style={{ width: "100%" }}
              disabled={pending}
            />
            <datalist id="category-suggestions">
              {[
                "Ramp",
                "Card Draw",
                "Removal",
                "Wipes",
                "Counterspells",
                "Tutors",
                "Win Condition",
                "Lands",
                "Utility",
              ].map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Printing selector */}
          {printings.length > 1 && (
            <div>
              <label className="eyebrow" style={{ display: "block", marginBottom: 6 }}>
                Printing
              </label>
              <select
                className="input"
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                disabled={pending}
                style={{ width: "100%" }}
              >
                {printings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.setName} #{p.collectorNumber}
                    {p.latestUsd != null ? ` — $${p.latestUsd.toFixed(2)}` : ""}
                    {p.id === entry.card.id ? " (current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "space-between" }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--neg)" }}
            onClick={handleRemove}
            disabled={pending}
          >
            Remove from deck
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={pending}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
