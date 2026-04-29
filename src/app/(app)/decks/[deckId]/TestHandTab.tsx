"use client";

import { useState } from "react";
import Image from "next/image";
import type { ClientDeckCard } from "./types";

type Props = {
  mainCards: ClientDeckCard[];
};

type HandCard = {
  key: string; // unique key per drawn instance
  name: string;
  imageNormal: string | null;
  manaCost: string;
  typeLine: string;
};

/** Expand DeckCards into individual card instances for shuffling */
function expandDeck(cards: ClientDeckCard[]): HandCard[] {
  const deck: HandCard[] = [];
  let idx = 0;
  for (const entry of cards) {
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

export function TestHandTab({ mainCards }: Props) {
  const [hand, setHand] = useState<HandCard[]>([]);
  const [deck, setDeck] = useState<HandCard[]>([]);

  function drawHand() {
    const shuffled = shuffle(expandDeck(mainCards));
    setDeck(shuffled.slice(7));
    setHand(shuffled.slice(0, 7));
  }

  function drawOne() {
    if (deck.length === 0) return;
    setHand((h) => [...h, deck[0]]);
    setDeck((d) => d.slice(1));
  }

  function mulligan() {
    drawHand();
  }

  function clearHand() {
    setHand([]);
    setDeck([]);
  }

  const isEmpty = mainCards.length === 0;
  const deckSize = mainCards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          className="btn btn-primary"
          onClick={drawHand}
          disabled={isEmpty}
          aria-label="Shuffle and draw opening hand"
        >
          ⟳ Shuffle &amp; Draw 7
        </button>
        <button
          className="btn"
          onClick={drawOne}
          disabled={!hand.length || deck.length === 0}
          aria-label="Draw one more card"
        >
          + Draw 1
        </button>
        <button
          className="btn btn-ghost"
          onClick={mulligan}
          disabled={!hand.length || isEmpty}
          aria-label="Mulligan — draw a new hand of 7"
        >
          Mulligan
        </button>
        {hand.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={clearHand}
            aria-label="Clear hand"
            style={{ marginLeft: "auto", color: "var(--ink-3)" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Info row */}
      {hand.length > 0 && (
        <div
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 10,
            color: "var(--ink-3)",
            marginBottom: 16,
            letterSpacing: "0.1em",
          }}
        >
          Hand: {hand.length} · Library: {deck.length} / {deckSize}
        </div>
      )}

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
            : "Click \"Shuffle & Draw 7\" to draw an opening hand."}
        </div>
      )}

      {/* Hand cards */}
      {hand.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
            padding: "10px 0 20px",
          }}
        >
          {hand.map((card, i) => (
            <div
              key={card.key}
              style={{
                width: 130,
                transform: `rotate(${(i - Math.floor(hand.length / 2)) * 2.5}deg) translateY(${Math.abs(i - Math.floor(hand.length / 2)) * 5}px)`,
                transition: "transform 300ms",
                position: "relative",
              }}
            >
              {card.imageNormal ? (
                <Image
                  src={card.imageNormal}
                  alt={card.name}
                  width={130}
                  height={181}
                  unoptimized
                  style={{
                    borderRadius: "4.5% / 3.2%",
                    boxShadow: "0 4px 20px oklch(0 0 0 / 0.5)",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 130,
                    height: 181,
                    background: "var(--bg-2)",
                    borderRadius: "4.5% / 3.2%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    border: "1px solid var(--line)",
                    padding: 8,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 11,
                      color: "var(--ink-1)",
                    }}
                  >
                    {card.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      fontSize: 9,
                      color: "var(--ink-3)",
                    }}
                  >
                    {card.typeLine}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
