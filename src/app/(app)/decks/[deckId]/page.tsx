import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestUsdToMxn } from "@/lib/money";
import { toNumber } from "@/lib/money-format";
import { checkDeckLegality } from "@/lib/deck-legality";
import { DeckBuilder } from "./DeckBuilder";
import { DeleteDeckButton } from "./DeleteDeckButton";

type PageProps = { params: Promise<{ deckId: string }> };

export default async function DeckDetailPage({ params }: PageProps) {
  const user = await requireUser();
  const { deckId } = await params;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { displayCurrency: true },
  });
  const currency = dbUser?.displayCurrency ?? "USD";
  const rate = await getLatestUsdToMxn();

  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId: user.id },
    select: {
      id: true,
      name: true,
      format: true,
      description: true,
      updatedAt: true,
      cards: {
        select: {
          id: true,
          quantity: true,
          isCommander: true,
          board: true,
          card: {
            select: {
              id: true,
              name: true,
              typeLine: true,
              manaCost: true,
              cmc: true,
              colors: true,
              colorIdentity: true,
              rarity: true,
              setCode: true,
              imageNormal: true,
              latestUsd: true,
              legalities: true,
            },
          },
        },
        orderBy: [{ board: "asc" }, { card: { name: "asc" } }],
      },
    },
  });

  if (!deck) notFound();

  const mainCards = deck.cards.filter((c) => c.board === "MAIN");
  const sideCards = deck.cards.filter((c) => c.board === "SIDE");

  const totalCards = mainCards.reduce((s, c) => s + c.quantity, 0);
  const totalUsd = mainCards.reduce(
    (s, c) => s + (toNumber(c.card.latestUsd) ?? 0) * c.quantity,
    0
  );

  // Color identity (union across mainboard)
  const colorSet = new Set<string>();
  for (const c of mainCards) {
    for (const col of c.card.colorIdentity) colorSet.add(col);
  }
  const colors = Array.from(colorSet).sort();

  // Legality check across all mainboard cards
  const legalityResult = checkDeckLegality(
    mainCards.map((c) => ({ legalities: c.card.legalities }))
  );

  // Mana curve: non-land cards by CMC bucket 0–6 (6 = 6+)
  const manaCurve: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const c of mainCards) {
    if (c.card.typeLine?.toLowerCase().includes("land")) continue;
    const bucket = Math.min(Math.floor(c.card.cmc ?? 0), 6);
    manaCurve[bucket] += c.quantity;
  }

  // Serializable card shape for client
  const toClientCard = (c: (typeof deck.cards)[0]) => ({
    id: c.id,
    quantity: c.quantity,
    isCommander: c.isCommander,
    board: c.board as "MAIN" | "SIDE",
    card: {
      id: c.card.id,
      name: c.card.name,
      typeLine: c.card.typeLine ?? "",
      manaCost: c.card.manaCost ?? "",
      cmc: c.card.cmc ?? 0,
      colors: c.card.colors,
      colorIdentity: c.card.colorIdentity,
      rarity: c.card.rarity,
      setCode: c.card.setCode,
      imageNormal: c.card.imageNormal ?? null,
      latestUsd: toNumber(c.card.latestUsd),
      legalities: c.card.legalities,
    },
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">
            <Link href="/decks" style={{ color: "var(--ink-3)" }}>
              Decks
            </Link>{" "}
            / {deck.name}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              margin: 0,
            }}
          >
            {deck.name}
          </h1>
        </div>
      </div>

      <div className="page-body">
        {/* Deck header panel */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {/* Color identity pips */}
            <div style={{ display: "flex", gap: 4 }}>
              {colors.length > 0 ? (
                colors.map((c) => (
                  <i key={c} className={`ms ms-${c.toLowerCase()} ms-cost ms-shadow`} aria-hidden="true" />
                ))
              ) : (
                <i className="ms ms-c ms-cost ms-shadow" aria-hidden="true" />
              )}
            </div>

            {/* Format + card count + description */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                {deck.format || "No format"} · {totalCards} cards
              </div>
              {deck.description && (
                <div
                  style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}
                >
                  {deck.description}
                </div>
              )}
            </div>

            {/* Total value */}
            <div style={{ textAlign: "right" }}>
              <div className="eyebrow">Total Value</div>
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                  fontSize: 18,
                  color: "var(--accent)",
                  marginTop: 2,
                }}
              >
                {formatMoney(totalUsd, currency, rate)}
              </div>
            </div>

            <DeleteDeckButton deckId={deckId} />
          </div>
        </div>

        {/* Tab-based deck builder */}
        <DeckBuilder
          deckId={deckId}
          mainCards={mainCards.map(toClientCard)}
          sideCards={sideCards.map(toClientCard)}
          manaCurve={manaCurve}
          legalityResult={legalityResult}
          currency={currency}
          fxRate={rate}
        />
      </div>
    </div>
  );
}
