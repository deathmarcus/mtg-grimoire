"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createDeck } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

const FORMATS = [
  "Standard",
  "Pioneer",
  "Modern",
  "Legacy",
  "Vintage",
  "Pauper",
  "Commander",
  "Brawl",
  "Historic",
  "Explorer",
];

export function NewDeckForm() {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createDeck(formData);
      if (res && "error" in res) {
        setError(res.error);
      }
    });
  }

  return (
    <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && (
        <div
          role="alert"
          style={{
            color: "var(--neg)",
            fontSize: 13,
            padding: "10px 14px",
            background: "oklch(0.3 0.1 25 / 0.2)",
            border: "1px solid var(--neg)",
            borderRadius: "var(--r-sm)",
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label className="auth-label" htmlFor="deck-name">
          Name
        </label>
        <input
          id="deck-name"
          name="name"
          className="grimoire-input"
          placeholder="e.g. Jund Midrange"
          required
          maxLength={120}
          autoFocus
        />
      </div>

      <div>
        <label className="auth-label" htmlFor="deck-format">
          Format
        </label>
        <select id="deck-format" name="format" className="grimoire-input">
          <option value="">— Select format —</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="auth-label" htmlFor="deck-description">
          Description{" "}
          <span
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 10,
              color: "var(--ink-3)",
            }}
          >
            optional
          </span>
        </label>
        <textarea
          id="deck-description"
          name="description"
          className="grimoire-input"
          rows={3}
          maxLength={1000}
          placeholder="Strategy, notes, inspiration…"
          style={{ resize: "vertical" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <SubmitButton variant="primary">Create Deck</SubmitButton>
        <Link href="/decks" className="btn">
          Cancel
        </Link>
      </div>
    </form>
  );
}
