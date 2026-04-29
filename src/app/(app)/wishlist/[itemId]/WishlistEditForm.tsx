"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateWishlistItem } from "../actions";

export function WishlistEditForm({
  itemId,
  defaultValues,
  tagOptions,
}: {
  itemId: string;
  defaultValues: {
    quantityWanted: number;
    maxPriceUsd: string;
    priority: string;
    tag: string;
    notes: string;
  };
  tagOptions: string[];
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await updateWishlistItem(itemId, formData);
      if (res && "ok" in res) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="panel">
      <div className="panel-head">
        <div className="panel-title">Edit</div>
      </div>
      <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          <Field label="Quantity wanted">
            <input
              type="number"
              name="quantityWanted"
              defaultValue={defaultValues.quantityWanted}
              min={1}
              required
              className="grimoire-input"
            />
          </Field>
          <Field label="Max price (USD)">
            <input
              type="number"
              name="maxPriceUsd"
              step="0.01"
              min={0}
              defaultValue={defaultValues.maxPriceUsd}
              placeholder="No limit"
              className="grimoire-input"
            />
          </Field>
          <Field label="Priority">
            <select
              name="priority"
              defaultValue={defaultValues.priority}
              className="grimoire-input"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </Field>
          <Field label="Tag">
            <input
              type="text"
              name="tag"
              list="edit-tags"
              defaultValue={defaultValues.tag}
              placeholder="e.g. Deck Atraxa"
              className="grimoire-input"
            />
            <datalist id="edit-tags">
              {tagOptions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            name="notes"
            rows={2}
            maxLength={500}
            defaultValue={defaultValues.notes}
            placeholder="Optional notes…"
            className="grimoire-input"
            style={{ resize: "vertical" }}
          />
        </Field>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
            style={{ opacity: isPending ? 0.6 : undefined }}
          >
            {isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="chip pos">Saved</span>
          )}
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="auth-label">
      <span>{label}</span>
      {children}
    </label>
  );
}
