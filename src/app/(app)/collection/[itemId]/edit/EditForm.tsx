"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCollectionItem } from "../../actions";

type Props = {
  itemId: string;
  current: {
    quantity: number;
    foil: string;
    language: string;
    condition: string;
    collectionId: string;
    acquiredPrice: string;
    notes: string;
  };
  card: {
    foilAvailable: boolean;
    etchedAvailable: boolean;
  };
  collections: { id: string; name: string }[];
};

export function EditForm({ itemId, current, card, collections }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [merged, setMerged] = useState(false);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await updateCollectionItem(itemId, formData);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.merged) setMerged(true);
      router.push(res.redirectTo);
      router.refresh();
    });
  };

  return (
    <form
      action={handleSubmit}
      className="panel"
      style={{ opacity: pending ? 0.6 : undefined }}
    >
      <div className="panel-head">
        <div className="panel-title">Edit details</div>
      </div>
      <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 10,
          }}
        >
          <label className="auth-label">
            <span>Folder</span>
            <select name="collectionId" defaultValue={current.collectionId} className="grimoire-input">
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="auth-label">
            <span>Quantity</span>
            <input type="number" name="quantity" defaultValue={current.quantity} min={1} required className="grimoire-input" />
          </label>
          <label className="auth-label">
            <span>Finish</span>
            <select name="foil" defaultValue={current.foil} className="grimoire-input">
              <option value="NORMAL">Normal</option>
              <option value="FOIL" disabled={!card.foilAvailable}>Foil</option>
              <option value="ETCHED" disabled={!card.etchedAvailable}>Etched</option>
            </select>
          </label>
          <label className="auth-label">
            <span>Condition</span>
            <select name="condition" defaultValue={current.condition} className="grimoire-input">
              {["NM", "LP", "MP", "HP", "DMG"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="auth-label">
            <span>Language</span>
            <input type="text" name="language" defaultValue={current.language} className="grimoire-input" />
          </label>
          <label className="auth-label">
            <span>Acquired price (USD)</span>
            <input type="number" name="acquiredPrice" defaultValue={current.acquiredPrice} step="0.01" min={0} className="grimoire-input" />
          </label>
        </div>

        <label className="auth-label">
          <span>Notes</span>
          <textarea name="notes" defaultValue={current.notes} maxLength={500} rows={3} className="grimoire-input" style={{ resize: "vertical" }} />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          {error && (
            <span className="chip neg">{error}</span>
          )}
          {merged && (
            <span className="chip pos">Merged with existing item.</span>
          )}
        </div>
      </div>
    </form>
  );
}
