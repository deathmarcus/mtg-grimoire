import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { auth } from "@/auth";
import { getPublicDeckBySlug, groupPublicCardsByType } from "@/lib/public-deck";
import { shouldIndex } from "@/lib/deck-slug";
import { ManaCost } from "@/components/ManaCost";
import { PublicDeckActions } from "./PublicDeckActions";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const deck = await getPublicDeckBySlug(slug);
  if (!deck) return { title: "Deck no encontrado — Grimoire" };

  const description = deck.description
    ? deck.description.slice(0, 160)
    : `${deck.format || "Deck"} · ${deck.totalCards} cartas`;

  return {
    title: `${deck.name} — Grimoire`,
    description,
    robots: { index: shouldIndex(deck.publicSince, new Date()) },
    openGraph: {
      title: deck.name,
      description,
    },
  };
}

function CardRow({
  card,
}: {
  card: { card: { name: string; manaCost: string | null }; quantity: number };
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 0",
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono), monospace",
          color: "var(--ink-3)",
          minWidth: 20,
        }}
      >
        {card.quantity}×
      </span>
      <span style={{ flex: 1 }}>{card.card.name}</span>
      <ManaCost cost={card.card.manaCost} />
    </div>
  );
}

export default async function PublicDeckPage({ params }: PageProps) {
  const { slug } = await params;
  const deck = await getPublicDeckBySlug(slug);
  if (!deck) notFound();

  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);

  const mainGroups = groupPublicCardsByType(deck.mainCards);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div className="eyebrow">{deck.format || "Deck"}</div>
      <h1
        style={{
          fontFamily: "var(--font-crimson-pro), Georgia, serif",
          fontSize: 30,
          margin: "4px 0 8px",
        }}
      >
        {deck.name}
      </h1>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 12,
            color: "var(--ink-2)",
          }}
        >
          {deck.totalCards} cartas
          {deck.ownerName ? ` · por ${deck.ownerName}` : ""}
        </span>
        <PublicDeckActions slug={slug} isLoggedIn={isLoggedIn} />
      </div>

      {deck.description && (
        <p style={{ color: "var(--ink-2)", fontSize: 14, marginBottom: 24 }}>
          {deck.description}
        </p>
      )}

      {deck.commander && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-head">
            <span className="panel-title">Commander</span>
          </div>
          <div className="panel-body" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {deck.commander.card.imageNormal && (
              <Image
                src={deck.commander.card.imageNormal}
                alt={deck.commander.card.name}
                width={140}
                height={196}
                unoptimized
                style={{ borderRadius: 8, border: "1px solid var(--line-soft)" }}
              />
            )}
            <div>
              <div style={{ fontFamily: "var(--font-crimson-pro), Georgia, serif", fontSize: 18 }}>
                {deck.commander.card.name}
              </div>
              <ManaCost cost={deck.commander.card.manaCost} />
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <span className="panel-title">Mainboard</span>
        </div>
        <div className="panel-body">
          {mainGroups.map((group) => (
            <div key={group.type} style={{ marginBottom: 12 }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                {group.type} ({group.cards.reduce((s, c) => s + c.quantity, 0)})
              </div>
              {group.cards.map((c) => (
                <CardRow key={c.id} card={c} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {deck.sideCards.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Sideboard</span>
          </div>
          <div className="panel-body">
            {deck.sideCards.map((c) => (
              <CardRow key={c.id} card={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
