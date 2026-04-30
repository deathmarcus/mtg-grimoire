"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { IconDecks, IconPlus, IconGrid, IconList, IconImport } from "@/components/Icons";
import { DeckListView } from "./DeckListView";

export type DeckStat = {
  id: string;
  name: string;
  format: string;
  totalCards: number;
  formattedValue: string;
  coverImage: string | null;
  colors: string[];
  updatedAt: string;
};

type Props = {
  decks: DeckStat[];
  emptyLabel: string;
  createFirstLabel: string;
};

export function DecksClient({ decks, emptyLabel, createFirstLabel }: Props) {
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 11,
            color: "var(--ink-3)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {decks.length} deck{decks.length !== 1 ? "s" : ""}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {decks.length > 0 && (
            <div className="toggle-group">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                className={view === "grid" ? "active" : ""}
                aria-label="Grid view"
              >
                <IconGrid size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={view === "list" ? "active" : ""}
                aria-label="List view"
              >
                <IconList size={14} />
              </button>
            </div>
          )}
          <Link href="/decks/import" className="btn btn-ghost btn-sm">
            <IconImport size={12} />
            Import
          </Link>
          <Link href="/decks/new" className="btn btn-primary btn-sm">
            <IconPlus size={12} />
            New Deck
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {decks.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ opacity: 0.25, marginBottom: 16 }}>
            <IconDecks size={40} className="icon" />
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              color: "var(--ink-1)",
              marginBottom: 8,
            }}
          >
            {emptyLabel}
          </div>
          <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 20 }}>
            Build your first deck to track value, test hands, and check format legality.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <Link href="/decks/import" className="btn btn-ghost">
              <IconImport size={14} />
              Import deck
            </Link>
            <Link href="/decks/new" className="btn btn-primary">
              <IconPlus size={14} />
              {createFirstLabel}
            </Link>
          </div>
        </div>
      ) : view === "list" ? (
        <DeckListView decks={decks} />
      ) : (
        /* Grid view */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 18,
          }}
        >
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/decks/${deck.id}`}
              style={{ textDecoration: "none" }}
            >
              <div className="panel" style={{ cursor: "pointer", overflow: "hidden" }}>
                {/* Cover art */}
                <div
                  style={{
                    position: "relative",
                    height: 140,
                    overflow: "hidden",
                    borderBottom: "1px solid var(--line-soft)",
                  }}
                >
                  {deck.coverImage ? (
                    <Image
                      src={deck.coverImage}
                      alt={deck.name}
                      fill
                      unoptimized
                      style={{
                        objectFit: "cover",
                        objectPosition: "center top",
                        transform: "scale(1.5) translateY(-5%)",
                        filter: "saturate(0.85)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "var(--bg-2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span style={{ opacity: 0.2 }}>
                        <IconDecks size={48} className="icon" />
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, transparent 30%, oklch(0.14 0.008 55 / 0.95))",
                    }}
                  />
                  {/* Color pips */}
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 12,
                      display: "flex",
                      gap: 4,
                    }}
                  >
                    {deck.colors.map((c) => (
                      <i
                        key={c}
                        className={`ms ms-${c.toLowerCase()} ms-cost ms-shadow`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  {/* Format chip */}
                  {deck.format && (
                    <div style={{ position: "absolute", top: 10, right: 12 }}>
                      <span className="chip warn">{deck.format}</span>
                    </div>
                  )}
                  {/* Deck name */}
                  <div
                    style={{
                      position: "absolute",
                      bottom: 12,
                      left: 14,
                      right: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        color: "var(--ink-0)",
                        textShadow: "0 1px 10px oklch(0 0 0 / 0.8)",
                      }}
                    >
                      {deck.name}
                    </div>
                  </div>
                </div>

                {/* Stats row */}
                <div
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="eyebrow">Value</div>
                    <div
                      style={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: 14,
                        color: "var(--accent)",
                        marginTop: 2,
                      }}
                    >
                      {deck.formattedValue}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Cards</div>
                    <div
                      style={{
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                        fontSize: 14,
                        marginTop: 2,
                      }}
                    >
                      {deck.totalCards}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
