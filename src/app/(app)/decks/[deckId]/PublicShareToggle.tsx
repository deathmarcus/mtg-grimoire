"use client";

import { useState, useTransition } from "react";
import { setDeckPublic } from "../actions";

export function PublicShareToggle({
  deckId,
  initialIsPublic,
  initialSlug,
}: {
  deckId: string;
  initialIsPublic: boolean;
  initialSlug: string | null;
}) {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [slug, setSlug] = useState(initialSlug);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !isPublic;
    setError(null);
    startTransition(async () => {
      const res = await setDeckPublic(deckId, next);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setIsPublic(next);
      setSlug(res.slug);
    });
  }

  function handleCopy() {
    if (!slug) return;
    const url = `${window.location.origin}/d/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button
        className="btn btn-sm"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={isPublic}
      >
        {isPublic ? "Público" : "Hacer público"}
      </button>
      {isPublic && slug && (
        <>
          <a
            href={`/d/${slug}`}
            target="_blank"
            rel="noreferrer"
            style={{
              fontFamily: "var(--font-jetbrains-mono), monospace",
              fontSize: 11,
              color: "var(--ink-2)",
            }}
          >
            /d/{slug}
          </a>
          <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </>
      )}
      {error && <span style={{ color: "var(--neg)", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
