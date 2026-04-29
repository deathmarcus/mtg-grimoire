"use client";

import { useState, useTransition } from "react";
import { updateCollectionItem } from "../actions";
import type { Condition, FoilKind } from "@prisma/client";

type Props = {
  itemId: string;
  initial: {
    quantity: number;
    foil: FoilKind;
    language: string;
    condition: Condition;
    collectionId: string;
    acquiredPrice: number | null;
    notes: string | null;
  };
};

const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];
const LANGUAGES: Array<[string, string]> = [
  ["en", "English"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["fr", "French"],
  ["de", "German"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zhs", "Chinese (S)"],
  ["zht", "Chinese (T)"],
  ["ru", "Russian"],
];

export function InlineEditForm({ itemId, initial }: Props) {
  const [editing, setEditing] = useState(false);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [condition, setCondition] = useState<Condition>(initial.condition);
  const [language, setLanguage] = useState(initial.language);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setQuantity(initial.quantity);
    setCondition(initial.condition);
    setLanguage(initial.language);
    setError(null);
    setEditing(false);
  }

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("quantity", String(quantity));
    fd.set("foil", initial.foil);
    fd.set("language", language);
    fd.set("condition", condition);
    fd.set("collectionId", initial.collectionId);
    if (initial.acquiredPrice != null) {
      fd.set("acquiredPrice", String(initial.acquiredPrice));
    }
    if (initial.notes) {
      fd.set("notes", initial.notes);
    }
    startTransition(async () => {
      const res = await updateCollectionItem(itemId, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setEditing(true)}
        aria-label="Quick edit qty / condition / language"
      >
        Quick edit
      </button>
    );
  }

  return (
    <div
      className="panel"
      style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 1fr",
          gap: 10,
          alignItems: "end",
        }}
      >
        <label className="auth-label">
          <span>Qty</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={9999}
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
              }
              className="grimoire-input"
              style={{ width: 64, textAlign: "center" }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setQuantity((q) => Math.min(9999, q + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>
        </label>
        <label className="auth-label">
          <span>Condition</span>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
            className="grimoire-input"
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="auth-label">
          <span>Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="grimoire-input"
          >
            {LANGUAGES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <span className="chip neg" style={{ alignSelf: "flex-start" }}>
          {error}
        </span>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onSave}
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn btn-sm"
          onClick={reset}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
