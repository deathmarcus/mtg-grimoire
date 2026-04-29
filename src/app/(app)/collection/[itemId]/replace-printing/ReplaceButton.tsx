"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { replacePrinting } from "../../actions";

export function ReplaceButton({
  itemId,
  newCardId,
  cardName,
}: {
  itemId: string;
  newCardId: string;
  cardName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm(`Replace current printing with "${cardName}"?`)) return;
    startTransition(async () => {
      const res = await replacePrinting(itemId, newCardId);
      if (res.ok) {
        router.push(res.redirectTo);
        router.refresh();
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="btn btn-primary btn-sm"
      style={{ flexShrink: 0, opacity: pending ? 0.5 : 1 }}
    >
      {pending ? "…" : "Select"}
    </button>
  );
}
