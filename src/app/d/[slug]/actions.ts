"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { SLUG_CHARSET_RE } from "@/lib/deck-slug";

// 10 clones per hour per user — generous for a genuine "I like this list"
// click, tight enough to block scripted spam-cloning of public decks.
const COPY_RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 };

const MAX_DECK_NAME_LENGTH = 120;

/**
 * Clones a public deck (name, format, description, all DeckCards) into the
 * signed-in caller's account and redirects to the new deck. Rejects private
 * decks, unauthenticated callers, and malformed slugs.
 */
export async function copyDeck(slug: string): Promise<{ error: string } | never> {
  if (!SLUG_CHARSET_RE.test(slug)) return { error: "Deck not found" };

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Sign in required" };

  const rate = checkRateLimit(`copy-deck:${userId}`, COPY_RATE_LIMIT);
  if (!rate.allowed) return { error: "Too many copies — try again later" };

  const source = await prisma.deck.findUnique({
    where: { slug },
    select: {
      name: true,
      format: true,
      description: true,
      isPublic: true,
      cards: {
        select: { cardId: true, quantity: true, isCommander: true, board: true, category: true },
      },
    },
  });
  if (!source || !source.isPublic) return { error: "Deck not found" };

  const copyName = `Copia de ${source.name}`.slice(0, MAX_DECK_NAME_LENGTH);

  const newDeck = await prisma.deck.create({
    data: {
      userId,
      name: copyName,
      format: source.format,
      description: source.description,
      cards: {
        create: source.cards.map((c) => ({
          cardId: c.cardId,
          quantity: c.quantity,
          isCommander: c.isCommander,
          board: c.board,
          category: c.category,
        })),
      },
    },
    select: { id: true },
  });

  revalidatePath("/decks");
  redirect(`/decks/${newDeck.id}`);
}
