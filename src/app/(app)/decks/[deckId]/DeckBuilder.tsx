"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { Currency } from "@prisma/client";
import type { ClientDeckCard, DeckLegality } from "./types";
import { MainboardTab } from "./MainboardTab";
import { CurveTab } from "./CurveTab";
import { TestHandModal } from "./TestHandModal";
import { StatsTab } from "./StatsTab";
import { InlineCardSearch } from "./InlineCardSearch";

type Section = "main" | "curve" | "stats";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "main", label: "Mainboard" },
  { id: "curve", label: "Curve" },
  { id: "stats", label: "Stats" },
];

type Props = {
  deckId: string;
  mainCards: ClientDeckCard[];
  sideCards: ClientDeckCard[];
  manaCurve: number[];
  legalityResult: DeckLegality;
  currency: Currency;
  fxRate: number;
};

export function DeckBuilder({
  deckId,
  mainCards,
  sideCards,
  manaCurve,
  legalityResult,
  currency,
  fxRate,
}: Props) {
  const mainRef = useRef<HTMLDivElement>(null);
  const curveRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<Section>("main");
  const [testHandOpen, setTestHandOpen] = useState(false);

  const refs: Record<Section, React.RefObject<HTMLDivElement | null>> = {
    main: mainRef,
    curve: curveRef,
    stats: statsRef,
  };

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const { id } of SECTIONS) {
      const el = refs[id].current;
      if (!el) continue;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { threshold: 0.2 }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = useCallback((id: Section) => {
    refs[id].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Commander color identity for out-of-color detection
  const commanderColors = new Set(
    mainCards
      .filter((c) => c.isCommander)
      .flatMap((c) => c.card.colorIdentity)
  );

  const totalMain = mainCards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="panel">
      {/* Inline card search */}
      <div style={{ padding: "14px 20px 0" }}>
        <InlineCardSearch deckId={deckId} />
      </div>

      {/* Nav bar */}
      <div
        className="tablist"
        role="tablist"
        aria-label="Deck builder sections"
        style={{ display: "flex", alignItems: "center" }}
      >
        {SECTIONS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeSection === id}
            onClick={() => scrollTo(id)}
            style={{ flex: "none" }}
          >
            {label}
          </button>
        ))}
        <button
          role="tab"
          aria-selected={false}
          onClick={() => setTestHandOpen(true)}
          style={{ flex: "none" }}
        >
          Test Hand
        </button>
      </div>

      {/* Legality banner */}
      <LegalityBanner mainCards={mainCards} format={null} totalMain={totalMain} />

      {/* Scrollable content */}
      <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 48 }}>
        <div ref={mainRef}>
          <MainboardTab
            deckId={deckId}
            mainCards={mainCards}
            sideCards={sideCards}
            currency={currency}
            fxRate={fxRate}
            commanderColors={commanderColors}
          />
        </div>

        <div ref={curveRef}>
          <CurveTab
            manaCurve={manaCurve}
            colorIdentity={collectColors(mainCards)}
            mainCards={mainCards}
          />
        </div>

        <div ref={statsRef}>
          <StatsTab mainCards={mainCards} currency={currency} fxRate={fxRate} />
        </div>
      </div>

      {/* Test Hand modal */}
      {testHandOpen && (
        <TestHandModal
          mainCards={mainCards}
          onClose={() => setTestHandOpen(false)}
        />
      )}
    </div>
  );
}

// ── Legality banner ────────────────────────────────────────────────────────

function LegalityBanner({
  mainCards,
  format,
  totalMain,
}: {
  mainCards: ClientDeckCard[];
  format: string | null;
  totalMain: number;
}) {
  const issues: string[] = [];

  const isCommander = format?.toLowerCase().includes("commander") ||
    mainCards.some((c) => c.isCommander);

  if (isCommander && totalMain !== 100) {
    issues.push(`Commander decks must have exactly 100 cards (currently ${totalMain})`);
  }

  const commanderColors = new Set(
    mainCards
      .filter((c) => c.isCommander)
      .flatMap((c) => c.card.colorIdentity)
  );

  if (commanderColors.size > 0) {
    const outOfColor = mainCards
      .filter((c) => !c.isCommander)
      .filter((c) =>
        c.card.colorIdentity.some((col) => !commanderColors.has(col))
      );
    if (outOfColor.length > 0) {
      issues.push(
        `${outOfColor.length} card${outOfColor.length > 1 ? "s" : ""} outside the commander's color identity`
      );
    }
  }

  if (issues.length === 0) return null;

  return (
    <div
      style={{
        margin: "0 20px",
        padding: "8px 14px",
        background: "oklch(0.35 0.12 30 / 0.25)",
        border: "1px solid oklch(0.65 0.18 30)",
        borderRadius: 6,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {issues.map((issue, i) => (
        <div key={i} style={{ fontSize: 12, color: "oklch(0.85 0.12 30)" }}>
          ⚠ {issue}
        </div>
      ))}
    </div>
  );
}

function collectColors(cards: ClientDeckCard[]): string[] {
  const s = new Set<string>();
  for (const c of cards) for (const col of c.card.colorIdentity) s.add(col);
  return Array.from(s).sort();
}
