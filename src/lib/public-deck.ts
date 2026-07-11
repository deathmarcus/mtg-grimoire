// Data loader for the public, view-only /d/[slug] deck page (F8 / #21).
// Kept separate from the page component so it's testable with vi.mock.

import { prisma } from "@/lib/prisma";
import { SLUG_CHARSET_RE } from "@/lib/deck-slug";
import { getTypeGroup, type TypeGroup } from "@/lib/list-controls";

export type PublicDeckCard = {
  id: string;
  quantity: number;
  isCommander: boolean;
  board: "MAIN" | "SIDE";
  card: {
    id: string;
    name: string;
    typeLine: string;
    manaCost: string | null;
    cmc: number | null;
    imageNormal: string | null;
    setCode: string;
    colorIdentity: string[];
  };
};

export type PublicDeck = {
  id: string;
  name: string;
  format: string;
  description: string | null;
  publicSince: Date | null;
  /** User.name only — never email. Null when the owner has no display name. */
  ownerName: string | null;
  commander: PublicDeckCard | null;
  mainCards: PublicDeckCard[];
  sideCards: PublicDeckCard[];
  totalCards: number;
  /** Best available art for the OG image: commander, else first mainboard card. */
  coverImage: string | null;
};

/**
 * Loads a deck for public, unauthenticated viewing. Returns null when the
 * slug is malformed, the deck doesn't exist, or the deck is not public —
 * callers should treat any null as notFound().
 */
export async function getPublicDeckBySlug(slug: string): Promise<PublicDeck | null> {
  if (!SLUG_CHARSET_RE.test(slug)) return null;

  const deck = await prisma.deck.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      format: true,
      description: true,
      isPublic: true,
      publicSince: true,
      user: { select: { name: true } },
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
              imageNormal: true,
              setCode: true,
              colorIdentity: true,
            },
          },
        },
        orderBy: [{ board: "asc" }, { card: { name: "asc" } }],
      },
    },
  });

  if (!deck || !deck.isPublic) return null;

  const toClientCard = (c: (typeof deck.cards)[number]): PublicDeckCard => ({
    id: c.id,
    quantity: c.quantity,
    isCommander: c.isCommander,
    board: c.board,
    card: {
      id: c.card.id,
      name: c.card.name,
      typeLine: c.card.typeLine ?? "",
      manaCost: c.card.manaCost,
      cmc: c.card.cmc,
      imageNormal: c.card.imageNormal,
      setCode: c.card.setCode,
      colorIdentity: c.card.colorIdentity,
    },
  });

  const allCards = deck.cards.map(toClientCard);
  const commander = allCards.find((c) => c.isCommander) ?? null;
  const mainCards = allCards.filter((c) => c.board === "MAIN" && !c.isCommander);
  const sideCards = allCards.filter((c) => c.board === "SIDE" && !c.isCommander);
  const totalCards = mainCards.reduce((s, c) => s + c.quantity, 0) + (commander?.quantity ?? 0);

  const coverImage = commander?.card.imageNormal ?? mainCards[0]?.card.imageNormal ?? null;

  return {
    id: deck.id,
    name: deck.name,
    format: deck.format,
    description: deck.description,
    publicSince: deck.publicSince,
    ownerName: deck.user.name,
    commander,
    mainCards,
    sideCards,
    totalCards,
    coverImage,
  };
}

/** Groups mainboard cards by type for display, in the standard TYPE_ORDER. */
export function groupPublicCardsByType(
  cards: PublicDeckCard[]
): { type: TypeGroup; cards: PublicDeckCard[] }[] {
  const buckets = new Map<TypeGroup, PublicDeckCard[]>();
  for (const c of cards) {
    const group = getTypeGroup(c.card.typeLine);
    const bucket = buckets.get(group) ?? [];
    bucket.push(c);
    buckets.set(group, bucket);
  }
  const order: TypeGroup[] = [
    "Creature",
    "Planeswalker",
    "Instant",
    "Sorcery",
    "Enchantment",
    "Artifact",
    "Land",
    "Other",
  ];
  return order
    .filter((t) => buckets.has(t))
    .map((type) => ({ type, cards: buckets.get(type)! }));
}
