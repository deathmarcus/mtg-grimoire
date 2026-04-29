"use client";

import { useState } from "react";
import type { Currency } from "@prisma/client";
import type { ClientDeckCard, DeckLegality } from "./types";
import { MainboardTab } from "./MainboardTab";
import { CurveTab } from "./CurveTab";
import { TestHandTab } from "./TestHandTab";
import { LegalityTab } from "./LegalityTab";
import { StatsTab } from "./StatsTab";
import { InlineCardSearch } from "./InlineCardSearch";

type Tab = "main" | "curve" | "test" | "legality" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "main", label: "Mainboard" },
  { id: "curve", label: "Curve" },
  { id: "test", label: "Test Hand" },
  { id: "legality", label: "Legality" },
  { id: "stats", label: "Stats" },
];

type Props = {
  deckId: string;
  mainCards: ClientDeckCard[];
  sideCards: ClientDeckCard[];
  manaCurve: number[]; // index 0–6, 6 = "6+"
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
  const [activeTab, setActiveTab] = useState<Tab>("main");

  return (
    <div className="panel">
      {/* Inline card search */}
      <div style={{ padding: "14px 20px 0" }}>
        <InlineCardSearch deckId={deckId} />
      </div>

      {/* Tab list */}
      <div
        className="tablist"
        role="tablist"
        aria-label="Deck builder sections"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            id={`tab-${id}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div style={{ padding: "22px 20px" }}>
        <div
          id="panel-main"
          role="tabpanel"
          aria-labelledby="tab-main"
          hidden={activeTab !== "main"}
        >
          <MainboardTab
            deckId={deckId}
            mainCards={mainCards}
            sideCards={sideCards}
            currency={currency}
            fxRate={fxRate}
          />
        </div>

        <div
          id="panel-curve"
          role="tabpanel"
          aria-labelledby="tab-curve"
          hidden={activeTab !== "curve"}
        >
          <CurveTab
            manaCurve={manaCurve}
            colorIdentity={collectColors(mainCards)}
            mainCards={mainCards}
          />
        </div>

        <div
          id="panel-test"
          role="tabpanel"
          aria-labelledby="tab-test"
          hidden={activeTab !== "test"}
        >
          <TestHandTab mainCards={mainCards} />
        </div>

        <div
          id="panel-legality"
          role="tabpanel"
          aria-labelledby="tab-legality"
          hidden={activeTab !== "legality"}
        >
          <LegalityTab legalityResult={legalityResult} />
        </div>

        <div
          id="panel-stats"
          role="tabpanel"
          aria-labelledby="tab-stats"
          hidden={activeTab !== "stats"}
        >
          <StatsTab mainCards={mainCards} currency={currency} fxRate={fxRate} />
        </div>
      </div>
    </div>
  );
}

function collectColors(cards: ClientDeckCard[]): string[] {
  const s = new Set<string>();
  for (const c of cards) {
    for (const col of c.card.colorIdentity) s.add(col);
  }
  return Array.from(s).sort();
}
