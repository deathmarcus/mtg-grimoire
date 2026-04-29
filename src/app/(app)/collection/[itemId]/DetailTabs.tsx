"use client";

import { useState, type ReactNode } from "react";

type TabId = "overview" | "history" | "editions" | "rulings";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "history", label: "History" },
  { id: "editions", label: "Editions" },
  { id: "rulings", label: "Rulings" },
];

type Props = {
  overview: ReactNode;
  history: ReactNode;
  editions: ReactNode;
  rulings: ReactNode;
  editionsCount?: number;
};

export function DetailTabs({
  overview,
  history,
  editions,
  rulings,
  editionsCount,
}: Props) {
  const [tab, setTab] = useState<TabId>("overview");

  const panels: Record<TabId, ReactNode> = {
    overview,
    history,
    editions,
    rulings,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div role="tablist" aria-label="Card detail sections" className="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            id={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === "editions" && editionsCount != null && editionsCount > 0 && (
              <span
                aria-hidden="true"
                style={{
                  marginLeft: 6,
                  fontSize: 10,
                  color: "var(--ink-3)",
                }}
              >
                {editionsCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        style={{ minHeight: 200 }}
      >
        {panels[tab]}
      </div>
    </div>
  );
}
