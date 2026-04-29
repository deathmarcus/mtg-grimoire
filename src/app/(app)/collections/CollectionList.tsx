"use client";

import { useTransition, useState } from "react";
import {
  renameCollection,
  deleteCollection,
  reorderCollection,
  toggleExcludeFromTotals,
} from "./actions";
import { IconEdit, IconTrash } from "@/components/Icons";

type CollectionRow = {
  id: string;
  name: string;
  isDefault: boolean;
  excludeFromTotals: boolean;
  itemCount: number;
};

export function CollectionList({
  collections,
}: {
  collections: CollectionRow[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {collections.map((c, idx) => (
        <CollectionCard
          key={c.id}
          collection={c}
          isFirst={idx === 0}
          isLast={idx === collections.length - 1}
        />
      ))}
    </div>
  );
}

function CollectionCard({
  collection: c,
  isFirst,
  isLast,
}: {
  collection: CollectionRow;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
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
    startTransition(async () => {
      await reorderCollection(c.id, dir);
    });
  };

  const handleToggleExclude = () => {
    startTransition(async () => {
      await toggleExcludeFromTotals(c.id);
    });
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
      className="panel"
      style={{ opacity: pending ? 0.6 : undefined, pointerEvents: pending ? "none" : undefined }}
    >
      <div className="panel-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          {editing ? (
            <form action={handleRename} style={{ display: "flex", gap: 8, flex: 1, minWidth: 0 }}>
              <input type="hidden" name="id" value={c.id} />
              <input
                name="name"
                defaultValue={c.name}
                required
                maxLength={50}
                autoFocus
                className="grimoire-input"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="submit" className="btn btn-sm btn-primary">
                Save
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null); }}
                className="btn btn-sm btn-ghost"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <a
                href={`/collection?folder=${c.id}`}
                style={{
                  fontFamily: "var(--font-crimson-pro), Georgia, serif",
                  fontSize: 16,
                  color: "var(--ink-0)",
                  textDecoration: "none",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {c.name}
              </a>
              {c.isDefault && <span className="chip">Default</span>}
            </>
          )}
        </div>

        {!editing && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => handleReorder("up")}
              disabled={isFirst}
              aria-label={`Move ${c.name} up`}
              className="btn btn-sm btn-ghost"
              style={{ opacity: isFirst ? 0.3 : 1 }}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => handleReorder("down")}
              disabled={isLast}
              aria-label={`Move ${c.name} down`}
              className="btn btn-sm btn-ghost"
              style={{ opacity: isLast ? 0.3 : 1 }}
            >
              ↓
            </button>
          </div>
        )}
      </div>

      <div className="panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
          {c.itemCount} {c.itemCount === 1 ? "card" : "cards"}
        </span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={c.excludeFromTotals}
            onChange={handleToggleExclude}
          />
          Exclude from totals
        </label>

        {!c.isDefault && !editing && (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="btn btn-sm btn-ghost"
              style={{ marginLeft: "auto" }}
            >
              <IconEdit size={12} /> Rename
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="btn btn-sm btn-ghost"
              style={{ color: "var(--neg)" }}
            >
              <IconTrash size={12} /> Delete
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: "0 18px 14px" }}>
          <span className="chip neg">{error}</span>
        </div>
      )}
    </div>
  );
}
