"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  previewDeckImport,
  applyDeckImport,
  type DeckPreviewResult,
  type DeckApplyResult,
} from "./actions";

export function DeckImportClient() {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [preview, setPreview] = useState<Extract<DeckPreviewResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DeckApplyResult | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onPreview() {
    setError(null);
    setResult(null);
    setPreview(null);
    const r = await previewDeckImport(text);
    if (!r.ok) {
      setError(r.error);
    } else {
      setPreview(r);
    }
  }

  function onApply() {
    if (!preview) return;
    const payload = JSON.stringify({
      tag,
      rows: preview.rows
        .filter((r) => r.matched)
        .map((r) => ({ scryfallId: r.scryfallId, needed: r.needed })),
    });
    startTransition(async () => {
      const r = await applyDeckImport(payload);
      setResult(r);
      if (r.ok) setPreview(null);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Paste deck list</div>
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="auth-label">
            <span>Deck list</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder={`Paste your deck list here…\n\nMoxfield format:\n1 Sol Ring (cmr) 385\n4 Lightning Bolt (2x2) 117\n\nArchidekt format:\nQuantity,Name,Set,Collector Number\n1,Sol Ring,cmr,385`}
              className="grimoire-input mono"
              style={{ resize: "vertical", fontSize: 12 }}
            />
          </label>
          <label className="auth-label" style={{ maxWidth: 280 }}>
            <span>Tag for this import</span>
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="e.g. Deck Atraxa"
              className="grimoire-input"
            />
          </label>
          <button
            type="button"
            onClick={onPreview}
            disabled={!text.trim()}
            className="btn btn-primary"
            style={{ alignSelf: "flex-start", opacity: !text.trim() ? 0.5 : 1 }}
          >
            Preview
          </button>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      {result && result.ok && (
        <div className="panel">
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="chip pos">Import complete</span>
            <p style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>
              {result.added} cards added to wishlist, {result.skipped} already owned.
            </p>
          </div>
        </div>
      )}
      {result && !result.ok && <div className="auth-error">{result.error}</div>}

      {preview && (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            <div className="stat">
              <div className="stat-label">Total</div>
              <div className="stat-value">{preview.counts.total}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Matched</div>
              <div className="stat-value">{preview.counts.matched}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Missing</div>
              <div className="stat-value" style={preview.counts.missing > 0 ? { color: "var(--neg)" } : undefined}>
                {preview.counts.missing}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Owned</div>
              <div className="stat-value">{preview.counts.alreadyOwned}</div>
            </div>
            <div className="stat">
              <div className="stat-label">To add</div>
              <div className="stat-value" style={preview.counts.toAdd > 0 ? { color: "var(--accent)" } : undefined}>
                {preview.counts.toAdd}
              </div>
            </div>
          </div>

          {preview.errors.length > 0 && (
            <details className="panel">
              <summary className="panel-head" style={{ cursor: "pointer" }}>
                <span className="chip warn">{preview.errors.length} parse warnings</span>
              </summary>
              <div className="panel-body">
                <ul style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: "var(--ink-2)" }}>
                  {preview.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            </details>
          )}

          <div className="panel">
            <div className="panel-body">
              <button
                type="button"
                onClick={onApply}
                disabled={isPending || preview.counts.toAdd === 0}
                className="btn btn-primary"
                style={{ opacity: isPending || preview.counts.toAdd === 0 ? 0.5 : 1 }}
              >
                {isPending ? "Importing…" : `Add ${preview.counts.toAdd} cards to wishlist`}
              </button>
            </div>
          </div>

          <div className="panel" style={{ overflow: "hidden", padding: 0 }}>
            {preview.rows.slice(0, 200).map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 18px",
                  borderBottom: "1px solid var(--line-soft)",
                }}
              >
                {r.imageSmall ? (
                  <Image
                    src={r.imageSmall}
                    alt={r.name}
                    width={40}
                    height={56}
                    style={{ width: 40, height: "auto", borderRadius: 2 }}
                    unoptimized
                  />
                ) : (
                  <div style={{ width: 40, height: 56, background: "var(--bg-2)", borderRadius: 2 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-crimson-pro), Georgia, serif",
                      fontSize: 13,
                      color: "var(--ink-0)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.name}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                    {r.setCode.toUpperCase()} #{r.collectorNumber}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-0)" }}>
                    ×{r.quantity}
                  </div>
                  {!r.matched ? (
                    <span className="chip neg" style={{ fontSize: 9 }}>not found</span>
                  ) : r.needed === 0 ? (
                    <span className="chip pos" style={{ fontSize: 9 }}>owned ({r.owned})</span>
                  ) : (
                    <span className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>
                      need {r.needed}{r.owned > 0 ? ` (have ${r.owned})` : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {preview.rows.length > 200 && (
              <div className="mono" style={{ padding: "12px 18px", fontSize: 11, color: "var(--ink-3)" }}>
                Showing first 200 of {preview.rows.length} rows.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
