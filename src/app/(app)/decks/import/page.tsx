import { requireUser } from "@/lib/session";
import { DeckImportClient } from "./DeckImportClient";

export default async function DeckImportPage() {
  await requireUser();

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Decks</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0 }}>
            Import deck
          </h1>
        </div>
      </div>

      <div className="page-body">
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: "var(--ink-2)", fontSize: 14, margin: 0 }}>
            Paste a Moxfield or MTG Arena deck export. Cards are matched against the local
            catalog with live Scryfall fallback for any missing entries.
          </p>
        </div>
        <DeckImportClient />
      </div>
    </div>
  );
}
