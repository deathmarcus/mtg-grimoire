"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCollectionItem } from "../actions";
import { IconTrash } from "@/components/Icons";

export function DeleteButton({
  itemId,
  cardName,
}: {
  itemId: string;
  cardName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    const ok = window.confirm(
      `Delete "${cardName}" from your collection? This cannot be undone.`,
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteCollectionItem(itemId);
      router.push("/collection");
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isPending}
      aria-label={`Delete ${cardName} from collection`}
      className="btn"
      style={{
        color: "var(--neg)",
        borderColor: "var(--neg)",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      <IconTrash size={12} />
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
