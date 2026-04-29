import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatMoney, getLatestUsdToMxn } from "@/lib/money";
import { toNumber } from "@/lib/money-format";
import { t, type Locale } from "@/lib/i18n";
import { DecksClient } from "./DecksClient";

export default async function DecksPage() {
  const user = await requireUser();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { displayCurrency: true, locale: true },
  });
  const currency = dbUser?.displayCurrency ?? "USD";
  const locale = (dbUser?.locale ?? "es") as Locale;
  const rate = await getLatestUsdToMxn();

  const decks = await prisma.deck.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      format: true,
      updatedAt: true,
      coverCard: {
        select: { imageNormal: true, name: true },
      },
      cards: {
        where: { board: "MAIN" },
        select: {
          quantity: true,
          board: true,
          card: {
            select: {
              latestUsd: true,
              imageNormal: true,
              colorIdentity: true,
            },
          },
        },
      },
    },
  });

  const deckStats = decks.map((deck) => {
    const totalCards = deck.cards.reduce((sum, c) => sum + c.quantity, 0);
    const totalUsd = deck.cards.reduce((sum, c) => {
      return sum + (toNumber(c.card.latestUsd) ?? 0) * c.quantity;
    }, 0);

    const coverImage =
      deck.coverCard?.imageNormal ??
      (deck.cards[0]?.card?.imageNormal ?? null);

    const colorSet = new Set<string>();
    for (const c of deck.cards) {
      for (const col of c.card.colorIdentity) colorSet.add(col);
    }

    return {
      id: deck.id,
      name: deck.name,
      format: deck.format,
      totalCards,
      formattedValue: formatMoney(totalUsd, currency, rate),
      coverImage,
      colors: Array.from(colorSet).sort(),
      updatedAt: deck.updatedAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    };
  });

  return (
    <div>
      <div className="topbar">
        <div>
          <div className="eyebrow">Grimoire</div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0 }}>
            Decks
          </h1>
        </div>
      </div>

      <div className="page-body">
        <DecksClient
          decks={deckStats}
          emptyLabel={t("page.decks.empty", locale)}
          createFirstLabel={t("page.decks.createFirst", locale)}
        />
      </div>
    </div>
  );
}
