import { parseManaCost } from "@/lib/mana-cost";

export function ManaCost({ cost }: { cost: string | null | undefined }) {
  const symbols = parseManaCost(cost);
  if (symbols.length === 0) return null;
  return (
    <span className="mana" aria-label={`Mana cost ${cost}`}>
      {symbols.map((s, i) => (
        <i
          key={i}
          className={`ms ms-${s.value.toLowerCase()} ms-cost ms-shadow`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
