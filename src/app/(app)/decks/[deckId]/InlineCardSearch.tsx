"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Image from "next/image";
import { searchCardsForDeck, addCardToDeck, type CardSearchResult } from "../actions";
import { IconSearch, IconPlus } from "@/components/Icons";

type Props = { deckId: string };

export function InlineCardSearch({ deckId }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CardSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CardSearchResult | null>(null);
  const [qty, setQty] = useState(1);
  const [board, setBoard] = useState<"MAIN" | "SIDE">("MAIN");
  const [added, setAdded] = useState(false);

  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleQueryChange(q: string) {
    setQuery(q);
    setSelected(null);
    setAdded(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        const r = await searchCardsForDeck(q);
        setResults(r);
        setOpen(r.length > 0);
      });
    }, 220);
  }

  function handleSelect(card: CardSearchResult) {
    setSelected(card);
    setQuery(card.name);
    setOpen(false);
    setQty(1);
    setAdded(false);
  }

  function handleAdd() {
    if (!selected) return;
    const fd = new FormData();
    fd.set("cardId", selected.id);
    fd.set("quantity", String(qty));
    fd.set("board", board);

    startAdd(async () => {
      await addCardToDeck(deckId, fd);
      setAdded(true);
      setSelected(null);
      setQuery("");
      setResults([]);
      setTimeout(() => setAdded(false), 2000);
    });
  }

  return (
    <div ref={containerRef} style={{ position: "relative", maxWidth: 480 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {/* Search input */}
        <div style={{ position: "relative", flex: 1 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ink-3)",
              pointerEvents: "none",
            }}
          >
            <IconSearch size={14} />
          </span>
          <input
            className="grimoire-input"
            style={{ width: "100%", paddingLeft: 32 }}
            placeholder="Add a card…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            aria-label="Search cards to add to deck"
            aria-autocomplete="list"
            aria-expanded={open}
          />
          {isSearching && (
            <span
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
                color: "var(--ink-3)",
              }}
            >
              …
            </span>
          )}
        </div>

        {/* Board selector */}
        {selected && (
          <select
            className="grimoire-input"
            style={{ width: 90 }}
            value={board}
            onChange={(e) => setBoard(e.target.value as "MAIN" | "SIDE")}
            aria-label="Board"
          >
            <option value="MAIN">Main</option>
            <option value="SIDE">Side</option>
          </select>
        )}

        {/* Qty input */}
        {selected && (
          <input
            type="number"
            className="grimoire-input"
            style={{ width: 56, textAlign: "center" }}
            min={1}
            max={99}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Math.min(99, Number(e.target.value))))}
            aria-label="Quantity"
          />
        )}

        {/* Add button */}
        {selected && (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleAdd}
            disabled={isAdding}
            aria-label="Add card to deck"
          >
            <IconPlus size={13} />
            {isAdding ? "…" : "Add"}
          </button>
        )}

        {added && (
          <span style={{ fontSize: 12, color: "var(--pos)" }}>Added ✓</span>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            marginTop: 4,
            boxShadow: "0 8px 24px oklch(0 0 0 / 0.4)",
            maxHeight: 320,
            overflowY: "auto",
          }}
          role="listbox"
          aria-label="Card search results"
        >
          {results.map((card) => (
            <button
              key={card.id}
              role="option"
              aria-selected={selected?.id === card.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "7px 10px",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--line-soft)",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--ink-1)",
              }}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(card); }}
            >
              {card.imageSmall ? (
                <Image
                  src={card.imageSmall}
                  alt={card.name}
                  width={28}
                  height={39}
                  unoptimized
                  style={{ borderRadius: 3, flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 28, height: 39, background: "var(--bg-3)", borderRadius: 3, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {card.name}
                </div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase" }}>
                  {card.setCode}
                  {card.latestUsd != null && (
                    <span style={{ marginLeft: 8, color: "var(--accent)" }}>
                      ${card.latestUsd.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
