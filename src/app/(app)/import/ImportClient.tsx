"use client";

import { useState, useTransition, useRef, type DragEvent } from "react";
import Image from "next/image";
import {
  previewImport,
  applyImport,
  type PreviewResult,
  type ApplyResult,
  type ImportFormat,
} from "./actions";
import { createCollection } from "../collections/actions";
import { IconPlus, IconImport } from "@/components/Icons";

type CollectionOption = { id: string; name: string };

const FORMAT_LABELS: Record<ImportFormat, string> = {
  manabox: "Manabox CSV",
  moxfield: "Moxfield TXT",
  arena: "Arena TXT",
};

const FORMAT_ACCEPT: Record<ImportFormat, string> = {
  manabox: ".csv,text/csv",
  moxfield: ".txt,text/plain",
  arena: ".txt,text/plain",
};

const FORMAT_HINT: Record<ImportFormat, string> = {
  manabox: "Manabox export CSV · máx 5 MB",
  moxfield: "Moxfield deck TXT · máx 5 MB",
  arena: "MTG Arena export TXT · máx 5 MB",
};

export function ImportClient({
  collections: initialCollections,
  defaultCollectionId,
}: {
  collections: CollectionOption[];
  defaultCollectionId: string;
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [format, setFormat] = useState<ImportFormat>("manabox");
  const [collectionId, setCollectionId] = useState(defaultCollectionId);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Drop-zone state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  // Inline folder creation
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderPending, startFolderTransition] = useTransition();
  const [folderError, setFolderError] = useState<string | null>(null);

  function handleFormatChange(newFormat: ImportFormat) {
    setFormat(newFormat);
    // Reset file when format changes — accept attributes change
    setFileName(null);
    setDropError(null);
    setPreview(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileSelected(file: File | null) {
    setDropError(null);
    if (!file) {
      setFileName(null);
      return;
    }
    const name = file.name.toLowerCase();
    const isValid =
      format === "manabox"
        ? name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel"
        : name.endsWith(".txt") || file.type === "text/plain";

    if (!isValid) {
      const ext = format === "manabox" ? ".csv" : ".txt";
      setDropError(`Solo se aceptan archivos ${ext} para el formato ${FORMAT_LABELS[format]}`);
      return;
    }
    setFileName(file.name);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      handleFileSelected(file);
    }
  }

  async function onPreview(formData: FormData) {
    setResult(null);
    setPreview(null);
    formData.set("format", format);
    const r = await previewImport(formData);
    setPreview(r);
  }

  function onApply() {
    if (!preview || !preview.ok) return;
    if (mode === "replace" && !confirmReplace) return;
    const payload = JSON.stringify({
      mode,
      format,
      filename: fileName ?? "import",
      collectionId,
      rows: preview.rows
        .filter((r) => r.matched)
        .map((r) => ({
          scryfallId: r.scryfallId,
          quantity: r.quantity,
          foil: r.foil,
          condition: r.condition,
          language: r.language,
          acquiredPrice: r.acquiredPrice,
          acquiredCurrency: r.acquiredCurrency,
        })),
    });
    startTransition(async () => {
      const r = await applyImport(payload);
      setResult(r);
      if (r.ok) {
        setPreview(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function onCreateFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setFolderError("Escribe un nombre");
      return;
    }
    setFolderError(null);
    const fd = new FormData();
    fd.set("name", name);
    startFolderTransition(async () => {
      const res = await createCollection(fd);
      if (!res.ok) {
        setFolderError(res.error);
        return;
      }
      setCollections((prev) => [...prev, { id: res.id, name: res.name }]);
      setCollectionId(res.id);
      setNewFolderName("");
      setCreatingFolder(false);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Folder selector + inline create */}
      <div className="panel">
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <label className="auth-label" style={{ flex: 1, minWidth: 220 }}>
              <span>Importar a</span>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="grimoire-input"
                disabled={creatingFolder || folderPending}
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            {!creatingFolder && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCreatingFolder(true);
                  setFolderError(null);
                }}
              >
                <IconPlus size={12} /> Nuevo folder
              </button>
            )}
          </div>
          {creatingFolder && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      onCreateFolder();
                    } else if (e.key === "Escape") {
                      setCreatingFolder(false);
                      setNewFolderName("");
                      setFolderError(null);
                    }
                  }}
                  placeholder="Nombre del folder…"
                  maxLength={50}
                  autoFocus
                  className="grimoire-input"
                  style={{ flex: 1 }}
                  disabled={folderPending}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={onCreateFolder}
                  disabled={folderPending || !newFolderName.trim()}
                >
                  Crear
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setCreatingFolder(false);
                    setNewFolderName("");
                    setFolderError(null);
                  }}
                  disabled={folderPending}
                >
                  Cancelar
                </button>
              </div>
              {folderError && <span className="chip neg">{folderError}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Upload form with format toggle + drop-zone */}
      <form action={onPreview} className="panel">
        <div className="panel-head">
          <div className="panel-title">Subir archivo</div>
          {/* Format toggle */}
          <div className="toggle-group" style={{ fontSize: 11 }}>
            {(["manabox", "moxfield", "arena"] as ImportFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                className={format === f ? "active" : ""}
                onClick={() => handleFormatChange(f)}
                aria-pressed={format === f}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            role="button"
            tabIndex={0}
            aria-label={`Arrastra un archivo ${format === "manabox" ? "CSV" : "TXT"} o haz click para seleccionar`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            style={{
              border: `1.5px dashed ${isDragging ? "var(--accent)" : "var(--line)"}`,
              borderRadius: "var(--r-md)",
              padding: "28px 18px",
              textAlign: "center",
              background: isDragging ? "var(--accent-bg)" : "var(--bg-0)",
              cursor: "pointer",
              transition: "background 120ms, border-color 120ms",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={{ color: isDragging ? "var(--accent)" : "var(--ink-2)" }}>
                <IconImport size={24} />
              </span>
              <div
                style={{
                  fontFamily: "var(--font-crimson-pro), Georgia, serif",
                  fontSize: 15,
                  color: "var(--ink-0)",
                }}
              >
                {fileName ?? `Arrastra el archivo aquí o haz click`}
              </div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {FORMAT_HINT[format]}
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              name="file"
              accept={FORMAT_ACCEPT[format]}
              required
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
          </div>
          {dropError && <span className="chip neg">{dropError}</span>}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ alignSelf: "flex-start" }}
            disabled={!fileName}
          >
            Generar preview
          </button>
        </div>
      </form>

      {preview && !preview.ok && (
        <div className="auth-error">{preview.error}</div>
      )}

      {result && result.ok && (
        <div className="panel">
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="chip pos">Import complete</span>
            <p style={{ fontSize: 13, color: "var(--ink-1)", marginTop: 4 }}>
              {result.replaced ? "Collection replaced. " : ""}
              {result.inserted} new entries, {result.merged} merged.
            </p>
          </div>
        </div>
      )}
      {result && !result.ok && (
        <div className="auth-error">{result.error}</div>
      )}

      {preview && preview.ok && (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
            <div className="stat">
              <div className="stat-label">Rows</div>
              <div className="stat-value">{preview.counts.total}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Quantity</div>
              <div className="stat-value">{preview.counts.totalQuantity}</div>
            </div>
            <div className="stat">
              <div className="stat-label">New</div>
              <div className="stat-value">{preview.counts.newItems}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Merged</div>
              <div className="stat-value">{preview.counts.merged}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Missing</div>
              <div className="stat-value" style={preview.counts.missing > 0 ? { color: "var(--neg)" } : undefined}>
                {preview.counts.missing}
              </div>
            </div>
          </div>

          {preview.parseErrors.length > 0 && (
            <details className="panel">
              <summary
                className="panel-head"
                style={{ cursor: "pointer" }}
              >
                <span className="chip warn">{preview.parseErrors.length} parse warnings</span>
              </summary>
              <div className="panel-body">
                <ul style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, color: "var(--ink-2)" }}>
                  {preview.parseErrors.slice(0, 50).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            </details>
          )}

          <div className="panel">
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="toggle-group">
                <button
                  type="button"
                  className={mode === "add" ? "active" : ""}
                  onClick={() => { setMode("add"); setConfirmReplace(false); }}
                >
                  Add to collection
                </button>
                <button
                  type="button"
                  className={mode === "replace" ? "active" : ""}
                  onClick={() => setMode("replace")}
                >
                  Replace collection
                </button>
              </div>
              {mode === "replace" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--neg)" }}>
                  <input
                    type="checkbox"
                    checked={confirmReplace}
                    onChange={(e) => setConfirmReplace(e.target.checked)}
                  />
                  I understand this will delete all existing collection items.
                </label>
              )}
              <button
                type="button"
                onClick={onApply}
                disabled={
                  isPending ||
                  preview.counts.matched === 0 ||
                  (mode === "replace" && !confirmReplace)
                }
                className="btn btn-primary"
                style={{
                  alignSelf: "flex-start",
                  opacity: isPending || preview.counts.matched === 0 || (mode === "replace" && !confirmReplace) ? 0.5 : 1,
                }}
              >
                {isPending ? "Importing…" : `Apply (${preview.counts.matched} cards)`}
              </button>
            </div>
          </div>

          {/* Preview rows */}
          <div className="panel" style={{ overflow: "hidden" }}>
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
                    alt={r.cardName ?? r.name}
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
                    {r.cardName ?? r.name}
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                    {r.setCode.toUpperCase()} #{r.collectorNumber} · {r.foil} · {r.condition} · {r.language}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-0)" }}>
                    ×{r.quantity}
                  </div>
                  {!r.matched ? (
                    <span className="chip neg" style={{ fontSize: 9 }}>missing</span>
                  ) : r.existingQuantity > 0 ? (
                    <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      have {r.existingQuantity}
                    </span>
                  ) : (
                    <span className="chip pos" style={{ fontSize: 9 }}>new</span>
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
