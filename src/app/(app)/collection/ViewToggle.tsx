"use client";

import { useTransition } from "react";
import type { ViewMode } from "@prisma/client";
import { setViewMode } from "./actions";
import { IconGrid, IconList } from "@/components/Icons";

export function ViewToggle({ current }: { current: ViewMode }) {
  const [isPending, start] = useTransition();

  const choose = (mode: ViewMode) => {
    if (mode === current || isPending) return;
    start(() => setViewMode(mode));
  };

  return (
    <div className="toggle-group">
      {(["GRID", "TABLE"] as ViewMode[]).map((mode) => {
        const active = mode === current;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => choose(mode)}
            aria-pressed={active}
            className={active ? "active" : ""}
            aria-label={mode === "GRID" ? "Grid view" : "List view"}
          >
            {mode === "GRID" ? <IconGrid size={14} /> : <IconList size={14} />}
          </button>
        );
      })}
    </div>
  );
}
