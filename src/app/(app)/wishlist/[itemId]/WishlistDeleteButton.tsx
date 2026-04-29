"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteWishlistItem } from "../actions";
import { IconTrash } from "@/components/Icons";

export function WishlistDeleteButton({
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
      `Remove "${cardName}" from your wishlist?`,
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteWishlistItem(itemId);
      router.push("/wishlist");
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isPending}
      aria-label={`Remove ${cardName} from wishlist`}
      className="btn"
      style={{
        color: "var(--neg)",
        borderColor: "var(--neg)",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      <IconTrash size={12} />
      {isPending ? "Removing…" : "Remove"}
    </button>
  );
}
