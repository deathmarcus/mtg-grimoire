// src/app/(app)/decks/[deckId]/OwnedBadge.tsx
export function OwnedBadge({ owned, needed }: { owned: number; needed: number }) {
  const cls =
    owned >= needed ? "is-full" : owned === 0 ? "is-none" : "is-partial";
  return (
    <span className={`owned-badge ${cls}`} title={`${owned}/${needed}`}>
      {owned >= needed ? "✓ " : ""}
      {owned}/{needed}
    </span>
  );
}
