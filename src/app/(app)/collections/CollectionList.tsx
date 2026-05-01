"use client";

import { useTransition, useState } from "react";
import Image from "next/image";
import type { Currency } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { IconEdit, IconTrash } from "@/components/Icons";
import {
  renameCollection,
  deleteCollection,
  reorderCollection,
  toggleExcludeFromTotals,
} from "./actions";

type CollectionRow = {
  id: string;
  name: string;
  isDefault: boolean;
  excludeFromTotals: boolean;
  itemCount: number;
  coverImageUrl: string | null;
  totalValue: number;
};

export function CollectionList({
  collections,
  currency,
  fxRate,
}: {
  collections: CollectionRow[];
  currency: Currency;
  fxRate: number;
}) {
  if (collections.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 0",
          color: "var(--ink-3)",
          fontFamily: "var(--font-crimson-pro), Georgia, serif",
          fontSize: 15,
          fontStyle: "italic",
        }}
      >
        No folders yet — create one above.
      </div>
    );
  }

  return (
    <div className="folder-grid">
      {collections.map((c, idx) => (
        <CollectionCard
          key={c.id}
          collection={c}
          isFirst={idx === 0}
          isLast={idx === collections.length - 1}
          currency={currency}
          fxRate={fxRate}
        />
      ))}
    </div>
  );
}

function CollectionCard({
  collection: c,
  isFirst,
  isLast,
  currency,
  fxRate,
}: {
  collection: CollectionRow;
  isFirst: boolean;
  isLast: boolean;
  currency: Currency;
  fxRate: number;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setMenuOpen(false);
    if (
      !confirm(
        `Borrar "${c.name}". Sus ${c.itemCount} cartas se moverán a "Mi colección". ¿Continuar?`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteCollection(c.id);
      if (!res.ok) setError(res.error);
    });
  };

  const handleReorder = (dir: "up" | "down") => {
    startTransition(() => void reorderCollection(c.id, dir));
  };

  const handleToggleExclude = () => {
    setMenuOpen(false);
    startTransition(() => void toggleExcludeFromTotals(c.id));
  };

  const handleRename = (formData: FormData) => {
    startTransition(async () => {
      const res = await renameCollection(formData);
      if (res.ok) {
        setEditing(false);
        setError(null);
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div
      className="folder-card"
      style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : undefined }}
    >
      {/* Background art */}
      {c.coverImageUrl ? (
        <Image
          src={c.coverImageUrl}
          alt=""
          fill
          unoptimized
          sizes="(max-width: 600px) 100vw, 280px"
          style={{
            objectFit: "cover",
            objectPosition: "top center",
            filter: "blur(3px) brightness(0.28) saturate(0.8)",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, var(--bg-2) 0%, var(--bg-3) 100%)",
          }}
        />
      )}

      {/* Gradient overlay — darkens bottom for text legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, oklch(0.08 0.01 55 / 0.95) 0%, oklch(0.08 0.01 55 / 0.4) 55%, transparent 100%)",
        }}
      />

      {/* Reorder arrows — top-left */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          gap: 2,
          zIndex: 2,
        }}
      >
        <button
          type="button"
          onClick={() => handleReorder("up")}
          disabled={isFirst}
          aria-label="Move up"
          className="btn btn-ghost btn-sm"
          style={{
            padding: "2px 5px",
            fontSize: 11,
            opacity: isFirst ? 0.2 : 0.7,
            background: "oklch(0 0 0 / 0.4)",
          }}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => handleReorder("down")}
          disabled={isLast}
          aria-label="Move down"
          className="btn btn-ghost btn-sm"
          style={{
            padding: "2px 5px",
            fontSize: 11,
            opacity: isLast ? 0.2 : 0.7,
            background: "oklch(0 0 0 / 0.4)",
          }}
        >
          ↓
        </button>
      </div>

      {/* Menu button — top-right */}
      {!c.isDefault && (
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 3 }}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="btn btn-ghost btn-sm"
            aria-label="Folder options"
            style={{
              padding: "2px 7px",
              fontSize: 14,
              background: "oklch(0 0 0 / 0.4)",
              opacity: 0.8,
            }}
          >
            ···
          </button>
          {menuOpen && (
            <div
              className="panel"
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                minWidth: 160,
                padding: "6px 0",
                zIndex: 10,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 14px",
                  borderRadius: 0,
                  fontSize: 12,
                }}
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
              >
                <IconEdit size={11} /> Rename
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 14px",
                  borderRadius: 0,
                  fontSize: 12,
                  color: "var(--ink-2)",
                }}
                onClick={handleToggleExclude}
              >
                {c.excludeFromTotals ? "✓ " : ""}Exclude from totals
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 14px",
                  borderRadius: 0,
                  fontSize: 12,
                  color: "var(--neg)",
                }}
                onClick={handleDelete}
              >
                <IconTrash size={11} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main link area — takes up most of the card */}
      <a
        href={`/collection?folder=${c.id}`}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
        }}
        aria-label={`Open folder ${c.name}`}
      />

      {/* Bottom content — name + stats */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "14px 14px 12px",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {editing ? (
          <form
            action={handleRename}
            style={{ display: "flex", gap: 6 }}
            onClick={(e) => e.stopPropagation()}
          >
            <input type="hidden" name="id" value={c.id} />
            <input
              name="name"
              defaultValue={c.name}
              required
              maxLength={50}
              autoFocus
              className="grimoire-input"
              style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "4px 8px" }}
            />
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              style={{ pointerEvents: "all" }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditing(false);
                setError(null);
              }}
              className="btn btn-sm btn-ghost"
              style={{ pointerEvents: "all" }}
            >
              ✕
            </button>
          </form>
        ) : (
          <>
            <div
              style={{
                fontFamily: "var(--font-crimson-pro), Georgia, serif",
                fontSize: 17,
                fontWeight: 500,
                color: "var(--ink-0)",
                lineHeight: 1.2,
                marginBottom: 5,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {c.name}
              {c.isDefault && (
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "var(--accent)",
                    border: "1px solid var(--accent)",
                    borderRadius: 3,
                    padding: "1px 4px",
                    lineHeight: 1.5,
                  }}
                >
                  Default
                </span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  letterSpacing: "0.08em",
                }}
              >
                {c.itemCount} {c.itemCount === 1 ? "card" : "cards"}
                {c.excludeFromTotals && (
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>(excl.)</span>
                )}
              </span>
              {c.totalValue > 0 && (
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono), monospace",
                    fontSize: 12,
                    color: "var(--accent)",
                    fontWeight: 500,
                  }}
                >
                  {formatMoney(c.totalValue, currency, fxRate)}
                </span>
              )}
            </div>
          </>
        )}

        {error && (
          <div style={{ marginTop: 6 }}>
            <span className="chip neg" style={{ fontSize: 10 }}>
              {error}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
