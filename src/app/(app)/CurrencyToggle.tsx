"use client";

import { useTransition } from "react";
import type { Currency } from "@prisma/client";
import { setDisplayCurrency } from "./actions";

export function CurrencyToggle({ current }: { current: Currency }) {
  const [isPending, startTransition] = useTransition();

  function set(next: Currency) {
    if (next === current || isPending) return;
    startTransition(() => {
      setDisplayCurrency(next);
    });
  }

  return (
    <div
      role="group"
      aria-label="Display currency"
      className="toggle-group"
    >
      {(["USD", "MXN"] as const).map((c) => {
        const active = c === current;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={active}
            disabled={isPending}
            onClick={() => set(c)}
            className={active ? "active" : ""}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
