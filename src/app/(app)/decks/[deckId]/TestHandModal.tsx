"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import type { ClientDeckCard } from "./types";

type HandCard = {
  key: string;
  name: string;
  imageNormal: string | null;
  manaCost: string;
  typeLine: string;
};

function expandDeck(cards: ClientDeckCard[]): HandCard[] {
  const deck: HandCard[] = [];
  let idx = 0;
  for (const entry of cards.filter((c) => !c.isCommander)) {
    for (let i = 0; i < entry.quantity; i++) {
      deck.push({
        key: `${entry.card.id}-${i}-${idx++}`,
        name: entry.card.name,
        imageNormal: entry.card.imageNormal,
        manaCost: entry.card.manaCost,
        typeLine: entry.card.typeLine,
      });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Props = {
  mainCards: ClientDeckCard[];
  onClose: () => void;
};

export function TestHandModal({ mainCards, onClose }: Props) {
  const [hand, setHand] = useState<HandCard[]>([]);
  const [library, setLibrary] = useState<HandCard[]>([]);

  const nonCommanderCards = mainCards.filter((c) => !c.isCommander);
  const deckSize = nonCommanderCards.reduce((s, c) => s + c.quantity, 0);
  const isEmpty = deckSize === 0;

  function drawHand() {
    const shuffled = shuffle(expandDeck(mainCards));
    setLibrary(shuffled.slice(7));
    setHand(shuffled.slice(0, 7));
  }

  function drawOne() {
    if (library.length === 0) return;
    setHand((h) => [...h, library[0]]);
    setLibrary((d) => d.slice(1));
  }

  function mulligan() {
    drawHand();
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
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
          width: "min(96vw, 960px)",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          position: "relative",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Test Hand"
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20, gap: 12 }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              margin: 0,
              flex: 1,
            }}
          >
            Test Hand
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            aria-label="Close"
            style={{ fontSize: 18, lineHeight: 1, padding: "2px 8px" }}
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={drawHand}
            disabled={isEmpty}
          >
            ⟳ Shuffle &amp; Draw 7
          </button>
          <button
            className="btn"
            onClick={drawOne}
            disabled={!hand.length || library.length === 0}
          >
            + Draw 1
          </button>
          <button
            className="btn btn-ghost"
            onClick={mulligan}
            disabled={!hand.length || isEmpty}
          >
            Mulligan
          </button>
          {hand.length > 0 && (
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 10,
                color: "var(--ink-3)",
                alignSelf: "center",
                letterSpacing: "0.1em",
              }}
            >
              Hand: {hand.length} · Library: {library.length} / {deckSize}
            </span>
          )}
        </div>

        {/* Empty state */}
        {hand.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              color: "var(--ink-3)",
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontStyle: "italic",
            }}
          >
            {isEmpty
              ? "Add cards to your mainboard to test a hand."
              : 'Click "Shuffle & Draw 7" to draw an opening hand.'}
          </div>
        )}

        {/* Hand — horizontal row, ~200px wide cards */}
        {hand.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              padding: "10px 0 20px",
              justifyContent: hand.length <= 5 ? "center" : "flex-start",
            }}
          >
            {hand.map((card) => (
              <div
                key={card.key}
                style={{ flexShrink: 0, width: 200 }}
              >
                {card.imageNormal ? (
                  <Image
                    src={card.imageNormal}
                    alt={card.name}
                    width={200}
                    height={279}
                    unoptimized
                    style={{
                      display: "block",
                      borderRadius: "4.5% / 3.2%",
                      boxShadow: "0 4px 20px oklch(0 0 0 / 0.5)",
                      width: 200,
                      height: "auto",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 200,
                      height: 279,
                      background: "var(--bg-2)",
                      borderRadius: "4.5% / 3.2%",
                      border: "1px solid var(--line)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: 12,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--ink-1)" }}>
                      {card.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 10, color: "var(--ink-3)" }}>
                      {card.typeLine}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
