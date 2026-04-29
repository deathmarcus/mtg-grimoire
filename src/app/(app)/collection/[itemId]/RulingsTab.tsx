import {
  formatLegalityStatus,
  type Legality,
} from "@/lib/card-detail";

type Props = {
  oracleText: string | null;
  typeLine: string | null;
  manaCost: string | null;
  legalities: Legality[];
};

export function RulingsTab({
  oracleText,
  typeLine,
  manaCost,
  legalities,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {(oracleText || typeLine || manaCost) && (
        <div className="panel">
          <div className="panel-head">
            <div className="panel-title">Oracle text</div>
          </div>
          <div
            className="panel-body"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {(typeLine || manaCost) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: "var(--ink-2)",
                }}
              >
                <span>{typeLine ?? ""}</span>
                <span className="mono">{manaCost ?? ""}</span>
              </div>
            )}
            {oracleText ? (
              <p
                style={{
                  color: "var(--ink-1)",
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                }}
              >
                {oracleText}
              </p>
            ) : (
              <p style={{ color: "var(--ink-3)", fontSize: 13 }}>
                No oracle text available.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Format legality</div>
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--ink-3)" }}
          >
            {legalities.length} formats
          </span>
        </div>
        <div className="panel-body">
          {legalities.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: 13 }}>
              No legality data. Run <code>npm run sync:catalog</code> to refresh.
            </p>
          ) : (
            <div className="legality-grid">
              {legalities.map((l) => (
                <div
                  key={l.format}
                  className={`legality-item is-${l.status}`}
                  title={`${l.format}: ${formatLegalityStatus(l.status)}`}
                >
                  <span className="legality-format">{l.format}</span>
                  <span className="legality-status">
                    {formatLegalityStatus(l.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
