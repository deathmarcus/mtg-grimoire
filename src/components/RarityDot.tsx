export function RarityDot({ rarity }: { rarity: string }) {
  const r = rarity.toLowerCase();
  return <span className={`rarity-dot ${r}`} title={r} aria-label={`Rarity: ${r}`} />;
}
