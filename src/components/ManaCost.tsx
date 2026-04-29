import { parseManaCost } from "@/lib/mana-cost";

export function ManaCost({ cost }: { cost: string | null | undefined }) {
  const symbols = parseManaCost(cost);
  if (symbols.length === 0) return null;
  return (
    <span className="mana" aria-label={`Mana cost ${cost}`}>
      {symbols.map((s, i) => {
        const cls =
          s.kind === "color"
            ? s.value.toLowerCase()
            : s.kind === "colorless"
            ? "c"
            : "c";
        return (
          <span key={i} className={`mana-pip ${cls}`}>
            {s.value}
          </span>
        );
      })}
    </span>
  );
}
