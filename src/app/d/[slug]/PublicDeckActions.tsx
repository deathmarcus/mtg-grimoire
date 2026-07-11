"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { copyDeck } from "./actions";

export function PublicDeckActions({
  slug,
  isLoggedIn,
}: {
  slug: string;
  isLoggedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isLoggedIn) {
    return (
      <Link href={`/login?callbackUrl=/d/${slug}`} className="btn btn-primary btn-sm">
        Inicia sesión para copiar este deck
      </Link>
    );
  }

  function handleCopy() {
    setError(null);
    startTransition(async () => {
      const res = await copyDeck(slug);
      // On success the action redirects (throws NEXT_REDIRECT), so any
      // resolved value here is an error result.
      if (res && "error" in res) setError(res.error);
    });
  }

  return (
    <div>
      <button className="btn btn-primary btn-sm" onClick={handleCopy} disabled={pending}>
        {pending ? "Copiando…" : "Copiar este deck"}
      </button>
      {error && (
        <div style={{ color: "var(--neg)", fontSize: 12, marginTop: 6 }}>{error}</div>
      )}
    </div>
  );
}
