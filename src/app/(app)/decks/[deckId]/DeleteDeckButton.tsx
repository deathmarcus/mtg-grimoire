"use client";

import { useTransition } from "react";
import { deleteDeck } from "../actions";
import { IconTrash } from "@/components/Icons";

export function DeleteDeckButton({ deckId }: { deckId: string }) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Delete this deck? This cannot be undone.")) return;
    startTransition(() => deleteDeck(deckId));
  }

  return (
    <button
      className="btn btn-sm"
      style={{ color: "var(--neg)" }}
      onClick={handleDelete}
      disabled={pending}
      aria-label="Delete deck"
    >
      <IconTrash size={12} />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
