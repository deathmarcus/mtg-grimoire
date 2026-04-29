import { requireUser } from "@/lib/session";
import { DeckImportClient } from "./DeckImportClient";

export default async function WishlistImportPage() {
  await requireUser();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Import a deck list</div>
        <h1
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: 24,
            fontWeight: 500,
          }}
        >
          Deck import
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: 13, lineHeight: 1.6, marginTop: 8, maxWidth: 520 }}>
          Paste a Moxfield (.txt) or Archidekt (.csv) export. Cards you already
          own will be skipped — only missing cards are added to your wishlist.
        </p>
      </div>
      <DeckImportClient />
    </div>
  );
}
