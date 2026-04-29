"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { setLocale } from "./actions";

export function LocaleToggle({ current }: { current: Locale }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function set(next: Locale) {
    if (next === current || isPending) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label="Display language"
      className="toggle-group"
    >
      {(["es", "en"] as const).map((loc) => {
        const active = loc === current;
        return (
          <button
            key={loc}
            type="button"
            aria-pressed={active}
            disabled={isPending}
            onClick={() => set(loc)}
            className={active ? "active" : ""}
          >
            {loc.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
