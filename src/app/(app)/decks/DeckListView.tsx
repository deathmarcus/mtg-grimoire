import Link from "next/link";
import type { DeckStat } from "./DecksClient";

export function DeckListView({ decks }: { decks: DeckStat[] }) {
  return (
    <div className="panel">
      <table className="tbl" style={{ width: "100%" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Colors</th>
            <th>Format</th>
            <th className="num">Updated</th>
          </tr>
        </thead>
        <tbody>
          {decks.map((deck) => (
            <tr key={deck.id}>
              <td>
                <Link
                  href={`/decks/${deck.id}`}
                  style={{
                    color: "var(--accent)",
                    textDecoration: "none",
                    fontFamily: "var(--font-display)",
                    fontSize: 15,
                  }}
                >
                  {deck.name}
                </Link>
              </td>
              <td>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {deck.colors.length > 0 ? (
                    deck.colors.map((c) => (
                      <i
                        key={c}
                        className={`ms ms-${c.toLowerCase()} ms-cost ms-shadow`}
                        aria-hidden="true"
                      />
                    ))
                  ) : (
                    <span style={{ color: "var(--ink-3)", fontSize: 12 }}>—</span>
                  )}
                </div>
              </td>
              <td>
                {deck.format ? (
                  <span className="chip warn">{deck.format}</span>
                ) : (
                  <span style={{ color: "var(--ink-3)" }}>—</span>
                )}
              </td>
              <td className="num">
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 12,
                    color: "var(--ink-3)",
                  }}
                >
                  {deck.updatedAt}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
