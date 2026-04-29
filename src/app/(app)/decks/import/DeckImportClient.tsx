"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  previewDeckImport,
  createDeckFromImport,
  type DeckPreviewResult,
  type DeckPreviewRow,
} from "./actions";
import { IconImport } from "@/components/Icons";

const FORMATS = [
  "Commander",
  "Modern",
  "Pioneer",
  "Standard",
  "Legacy",
  "Vintage",
  "Pauper",
  "Draft",
  "",
];

export function DeckImportClient() {
  // Step 1: deck metadata
  const [name, setName] = useState("");
  const [format, setFormat] = useState("Commander");

  // Step 2: pasted text
  const [text, setText] = useState("");

  // Preview state
  const [preview, setPreview] = useState<DeckPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Commander selection (when format=Commander and no auto-detected commander)
  const [commanderCardId, setCommanderCardId] = useState<string | null>(null);

  // Final result
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isPreviewing, startPreview] = useTransition();
  const [isSubmitting, startSubmit] = useTransition();

  const step = preview && preview.ok ? "preview" : "input";

  function handlePreview() {
    setPreviewError(null);
    if (!name.trim()) { setPreviewError("Enter a deck name first"); return; }
    if (!text.trim()) { setPreviewError("Paste a deck list first"); return; }

    const fd = new FormData();
    fd.set("text", text);

    startPreview(async () => {
      const result = await previewDeckImport(fd);
      setPreview(result);
      if (result.ok) {
        // Pre-select auto-detected commander
        const autoCommander = result.rows.find((r) => r.isCommander && r.cardId);
        setCommanderCardId(autoCommander?.cardId ?? null);
      } else {
        setPreviewError(result.error);
      }
    });
  }

  function handleBack() {
    setPreview(null);
    setPreviewError(null);
    setSubmitError(null);
  }

  function handleConfirm() {
    if (!preview || !preview.ok) return;

    const validRows = preview.rows
      .filter((r) => r.matched && r.cardId)
      .map((r) => ({
        cardId: r.cardId!,
        quantity: r.quantity,
        isCommander: r.cardId === commanderCardId,
        board: r.board,
      }));

    const payload = JSON.stringify({
      name: name.trim(),
      format: format.trim(),
      commanderCardId: commanderCardId ?? null,
      rows: validRows,
    });

    setSubmitError(null);
    startSubmit(async () => {
      const result = await createDeckFromImport(payload);
      // redirect() throws NEXT_REDIRECT so we only reach here on error
      if (!result.ok) setSubmitError(result.error);
    });
  }

  const isCommander = format.toLowerCase() === "commander";

  return (
    <div style={{ maxWidth: 760 }}>
      {/* ── Step 1 & 2: input form ── */}
      {step === "input" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Deck name */}
          <div>
            <label
              htmlFor="deck-name"
              className="eyebrow"
              style={{ display: "block", marginBottom: 6 }}
            >
              Deck name
            </label>
            <input
              id="deck-name"
              className="grimoire-input"
              style={{ width: "100%" }}
              placeholder="e.g. Atraxa Superfriends"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Format */}
          <div>
            <label
              htmlFor="deck-format"
              className="eyebrow"
              style={{ display: "block", marginBottom: 6 }}
            >
              Format
            </label>
            <select
              id="deck-format"
              className="grimoire-input"
              style={{ width: "100%" }}
              value={format}
              onChange={(e) => setFormat(e.target.value)}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f || "— None —"}
                </option>
              ))}
            </select>
          </div>

          {/* Paste area */}
          <div>
            <label
              htmlFor="deck-text"
              className="eyebrow"
              style={{ display: "block", marginBottom: 6 }}
            >
              Deck list
            </label>
            <div
              style={{
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 11,
                color: "var(--ink-3)",
                marginBottom: 8,
              }}
            >
              Paste a Moxfield or MTG Arena export. Accepts <code>{"*CMDR*"}</code> markers and{" "}
              <code>{"// Commander"}</code> sections.
            </div>
            <textarea
              id="deck-text"
              className="grimoire-input"
              style={{ width: "100%", minHeight: 260, resize: "vertical", fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 12 }}
              placeholder={`// Commander\n1 Atraxa, Praetors' Voice (ONE) 268\n// Mainboard\n4 Sol Ring (cmr) 385\n...`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          {previewError && (
            <div
              role="alert"
              style={{ color: "var(--neg)", fontSize: 13, padding: "8px 12px", background: "oklch(0.3 0.1 25 / 0.15)", borderRadius: 6 }}
            >
              {previewError}
            </div>
          )}

          <div>
            <button
              className="btn btn-primary"
              onClick={handlePreview}
              disabled={isPreviewing}
            >
              <IconImport size={14} />
              {isPreviewing ? "Resolving cards…" : "Preview"}
            </button>
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      {step === "preview" && preview && preview.ok && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Summary */}
          <div className="panel" style={{ padding: "14px 18px" }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div className="eyebrow">Deck</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, marginTop: 2 }}>{name}</div>
              </div>
              {format && (
                <div>
                  <div className="eyebrow">Format</div>
                  <div style={{ marginTop: 4 }}><span className="chip warn">{format}</span></div>
                </div>
              )}
              <div>
                <div className="eyebrow">Found</div>
                <div style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 14, color: "var(--pos)", marginTop: 2 }}>
                  {preview.counts.found}
                </div>
              </div>
              {preview.counts.notFound > 0 && (
                <div>
                  <div className="eyebrow">Not found</div>
                  <div style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 14, color: "var(--neg)", marginTop: 2 }}>
                    {preview.counts.notFound}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Parse errors */}
          {preview.parseErrors.length > 0 && (
            <details className="panel" style={{ padding: "10px 14px" }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--neg)" }}>
                {preview.parseErrors.length} parse warning{preview.parseErrors.length !== 1 ? "s" : ""}
              </summary>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: 16, fontSize: 11, color: "var(--ink-3)" }}>
                {preview.parseErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </details>
          )}

          {/* Commander selector */}
          {isCommander && (
            <div className="panel" style={{ padding: "14px 18px" }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Commander</div>
              {preview.detectedCommanderName && (
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8 }}>
                  Auto-detected: <strong style={{ color: "var(--ink-1)" }}>{preview.detectedCommanderName}</strong>
                </div>
              )}
              <select
                className="grimoire-input"
                style={{ width: "100%" }}
                value={commanderCardId ?? ""}
                onChange={(e) => setCommanderCardId(e.target.value || null)}
              >
                <option value="">— None —</option>
                {preview.rows
                  .filter((r) => r.matched && r.cardId && r.board === "MAIN")
                  .map((r) => (
                    <option key={r.cardId} value={r.cardId!}>
                      {r.cardName ?? r.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Card table */}
          <div className="panel" style={{ overflow: "hidden" }}>
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Card</th>
                  <th>Set</th>
                  <th className="num">Qty</th>
                  <th>Board</th>
                  <th className="num">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((row, i) => (
                  <PreviewRowItem key={i} row={row} isCommanderCard={row.cardId === commanderCardId} />
                ))}
              </tbody>
            </table>
            {preview.rows.length > 200 && (
              <div style={{ padding: "8px 16px", fontSize: 11, color: "var(--ink-3)", borderTop: "1px solid var(--line-soft)" }}>
                Showing first 200 of {preview.rows.length} rows
              </div>
            )}
          </div>

          {submitError && (
            <div role="alert" style={{ color: "var(--neg)", fontSize: 13, padding: "8px 12px", background: "oklch(0.3 0.1 25 / 0.15)", borderRadius: 6 }}>
              {submitError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" onClick={handleBack} disabled={isSubmitting}>
              ← Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={isSubmitting || preview.counts.found === 0}
            >
              <IconImport size={14} />
              {isSubmitting
                ? "Creating deck…"
                : `Create deck (${preview.counts.found} cards)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewRowItem({
  row,
  isCommanderCard,
}: {
  row: DeckPreviewRow;
  isCommanderCard: boolean;
}) {
  return (
    <tr style={{ opacity: row.matched ? 1 : 0.45 }}>
      <td style={{ width: 40, padding: "4px 8px" }}>
        {row.imageSmall ? (
          <Image
            src={row.imageSmall}
            alt={row.cardName ?? row.name}
            width={32}
            height={44}
            unoptimized
            style={{ borderRadius: 3, display: "block" }}
          />
        ) : (
          <div style={{ width: 32, height: 44, background: "var(--bg-3)", borderRadius: 3 }} />
        )}
      </td>
      <td>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>
          {row.cardName ?? row.name}
        </span>
        {isCommanderCard && (
          <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 9, color: "var(--accent)", marginLeft: 6 }}>
            CMDR
          </span>
        )}
        {!row.matched && (
          <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 9, color: "var(--neg)", marginLeft: 6 }}>
            NOT FOUND
          </span>
        )}
      </td>
      <td>
        <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase" }}>
          {row.setCode}
        </span>
      </td>
      <td className="num">
        <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 12 }}>
          {row.quantity}
        </span>
      </td>
      <td>
        <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase" }}>
          {row.board}
        </span>
      </td>
      <td className="num">
        <span className={`chip ${row.matched ? "pos" : "neg"}`} style={{ fontSize: 10 }}>
          {row.matched ? "found" : "missing"}
        </span>
      </td>
    </tr>
  );
}
