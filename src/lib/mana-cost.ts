export type ManaSymbolKind =
  | "color"
  | "generic"
  | "variable"
  | "hybrid"
  | "phyrexian"
  | "colorless";

export type ManaSymbol = {
  kind: ManaSymbolKind;
  value: string;
};

const COLOR_SYMBOLS = new Set(["W", "U", "B", "R", "G"]);

export function parseManaCost(cost: string | null | undefined): ManaSymbol[] {
  if (!cost) return [];
  const tokens = cost.match(/\{[^}]+\}/g);
  if (!tokens) return [];
  return tokens.map((tok) => {
    const v = tok.slice(1, -1);
    if (v === "X" || v === "Y" || v === "Z") return { kind: "variable", value: v };
    if (v === "C") return { kind: "colorless", value: v };
    if (/^\d+$/.test(v)) return { kind: "generic", value: v };
    if (v.endsWith("/P")) return { kind: "phyrexian", value: v };
    if (v.includes("/")) return { kind: "hybrid", value: v };
    if (COLOR_SYMBOLS.has(v)) return { kind: "color", value: v };
    return { kind: "generic", value: v };
  });
}
